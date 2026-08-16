package com.smr.mirroring.media

import android.content.Context
import android.content.Intent
import android.util.Log
import com.smr.mirroring.service.RemoteAccessibilityService
import org.json.JSONObject
import org.webrtc.*

class WebRtcMediaManager(private val context: Context) {

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var rootEglBase: EglBase = EglBase.create()

    init {
        initializePeerConnectionFactory()
    }

    private fun initializePeerConnectionFactory() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(rootEglBase.eglBaseContext)

        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    fun startWebRtcSession(
        capturer: VideoCapturer,
        iceServers: List<PeerConnection.IceServer>,
        onSdpOfferCreated: (String) -> Unit,
        onIceCandidateGenerated: (PeerConnection.IceCandidate) -> Unit
    ) {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val pcObserver = object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let { onIceCandidateGenerated(it) }
            }
            override fun onDataChannel(dc: DataChannel?) {
                dc?.let { setupDataChannel(it) }
            }
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.i(TAG, "WebRTC ICE Connection State: $state")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        }

        peerConnection = factory?.createPeerConnection(rtcConfig, pcObserver)

        // Add Video Track from ScreenCapturer
        val surfaceTextureHelper = SurfaceTextureHelper.create("CaptureThread", rootEglBase.eglBaseContext)
        videoSource = factory?.createVideoSource(capturer.isScreencast)
        capturer.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        capturer.startCapture(1080, 1920, 30) // 1080p @ 30 FPS

        videoTrack = factory?.createVideoTrack("SMR_VIDEO_TRACK", videoSource)
        videoTrack?.setEnabled(true)
        peerConnection?.addTrack(videoTrack, listOf("SMR_MEDIA_STREAM"))

        // Create DataChannel for Low-Latency Remote Input
        val dcInit = DataChannel.Init().apply {
            ordered = true
        }
        dataChannel = peerConnection?.createDataChannel("input_control", dcInit)
        dataChannel?.let { setupDataChannel(it) }

        // Create SDP Offer
        val mediaConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp ?: return
                peerConnection?.setLocalDescription(object : SdpObserver {
                    override fun onCreateSuccess(p0: SessionDescription?) {}
                    override fun onSetSuccess() {
                        onSdpOfferCreated(sdp.description)
                    }
                    override fun onCreateFailure(p0: String?) {}
                    override fun onSetFailure(p0: String?) {}
                }, sdp)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(err: String?) { Log.e(TAG, "SDP offer failed: $err") }
            override fun onSetFailure(err: String?) {}
        }, mediaConstraints)
    }

    fun setRemoteAnswer(sdpAnswer: String) {
        val sdp = SessionDescription(SessionDescription.Type.ANSWER, sdpAnswer)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() { Log.i(TAG, "Remote SDP answer set successfully.") }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(err: String?) { Log.e(TAG, "Failed to set remote SDP answer: $err") }
        }, sdp)
    }

    fun addRemoteIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidateSdp: String) {
        val candidate = IceCandidate(sdpMid, sdpMLineIndex, candidateSdp)
        peerConnection?.addIceCandidate(candidate)
    }

    private fun setupDataChannel(dc: DataChannel) {
        dc.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) {}
            override fun onStateChange() {
                Log.i(TAG, "DataChannel State changed: ${dc.state()}")
            }
            override fun onMessage(buffer: DataChannel.Buffer?) {
                buffer ?: return
                val data = ByteArray(buffer.data.remaining())
                buffer.data.get(data)
                val jsonStr = String(data, Charsets.UTF_8)
                parseAndDispatchInputEvent(jsonStr)
            }
        })
    }

    private fun parseAndDispatchInputEvent(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val action = json.optString("action")
            val normX = json.optDouble("normalizedX", 0.0).toFloat()
            val normY = json.optDouble("normalizedY", 0.0).toFloat()

            val intent = Intent("com.smr.mirroring.REMOTE_INPUT").apply {
                putExtra("ACTION", action)
                putExtra("NORM_X", normX)
                putExtra("NORM_Y", normY)
            }
            context.sendBroadcast(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing DataChannel input packet", e)
        }
    }

    fun close() {
        dataChannel?.close()
        peerConnection?.close()
        videoSource?.dispose()
        factory?.dispose()
        rootEglBase.release()
    }

    companion object {
        private const val TAG = "WebRtcMediaManager"
    }
}
