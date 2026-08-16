package com.smr.mirroring.media

import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

class WebRtcMediaManager(private val context: Context) {

    private var factory: org.webrtc.PeerConnectionFactory? = null
    private var peerConnection: org.webrtc.PeerConnection? = null
    private var dataChannel: org.webrtc.DataChannel? = null
    private var videoSource: org.webrtc.VideoSource? = null
    private var videoTrack: org.webrtc.VideoTrack? = null
    private var rootEglBase: org.webrtc.EglBase = org.webrtc.EglBase.create()

    init {
        initializePeerConnectionFactory()
    }

    private fun initializePeerConnectionFactory() {
        val options = org.webrtc.PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        org.webrtc.PeerConnectionFactory.initialize(options)

        val encoderFactory = org.webrtc.DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true)
        val decoderFactory = org.webrtc.DefaultVideoDecoderFactory(rootEglBase.eglBaseContext)

        factory = org.webrtc.PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    fun startWebRtcSession(
        capturer: org.webrtc.VideoCapturer,
        iceServers: List<org.webrtc.PeerConnection.IceServer>,
        onSdpOfferCreated: (String) -> Unit,
        onIceCandidateGenerated: (org.webrtc.IceCandidate) -> Unit
    ) {
        val rtcConfig = org.webrtc.PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = org.webrtc.PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = org.webrtc.PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val pcObserver = object : org.webrtc.PeerConnection.Observer {
            override fun onIceCandidate(candidate: org.webrtc.IceCandidate?) {
                candidate?.let { onIceCandidateGenerated(it) }
            }
            override fun onDataChannel(dc: org.webrtc.DataChannel?) {
                dc?.let { setupDataChannel(it) }
            }
            override fun onSignalingChange(state: org.webrtc.PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(state: org.webrtc.PeerConnection.IceConnectionState?) {
                Log.i(TAG, "WebRTC ICE Connection State: $state")
            }
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: org.webrtc.PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out org.webrtc.IceCandidate>?) {}
            override fun onAddStream(stream: org.webrtc.MediaStream?) {}
            override fun onRemoveStream(stream: org.webrtc.MediaStream?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: org.webrtc.RtpReceiver?, streams: Array<out org.webrtc.MediaStream>?) {}
        }

        peerConnection = factory?.createPeerConnection(rtcConfig, pcObserver)

        // Add Video Track from ScreenCapturer
        val surfaceTextureHelper = org.webrtc.SurfaceTextureHelper.create("CaptureThread", rootEglBase.eglBaseContext)
        videoSource = factory?.createVideoSource(capturer.isScreencast)
        capturer.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)
        capturer.startCapture(1080, 1920, 30) // 1080p @ 30 FPS

        videoTrack = factory?.createVideoTrack("SMR_VIDEO_TRACK", videoSource)
        videoTrack?.setEnabled(true)
        peerConnection?.addTrack(videoTrack, listOf("SMR_MEDIA_STREAM"))

        // Create DataChannel for Low-Latency Remote Input
        val dcInit = org.webrtc.DataChannel.Init().apply {
            ordered = true
        }
        dataChannel = peerConnection?.createDataChannel("input_control", dcInit)
        dataChannel?.let { setupDataChannel(it) }

        // Create SDP Offer
        val mediaConstraints = org.webrtc.MediaConstraints().apply {
            mandatory.add(org.webrtc.MediaConstraints.KeyValuePair("OfferToReceiveVideo", "false"))
            mandatory.add(org.webrtc.MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
        }

        peerConnection?.createOffer(object : org.webrtc.SdpObserver {
            override fun onCreateSuccess(sdp: org.webrtc.SessionDescription?) {
                sdp ?: return
                peerConnection?.setLocalDescription(object : org.webrtc.SdpObserver {
                    override fun onCreateSuccess(p0: org.webrtc.SessionDescription?) {}
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
        val sdp = org.webrtc.SessionDescription(org.webrtc.SessionDescription.Type.ANSWER, sdpAnswer)
        peerConnection?.setRemoteDescription(object : org.webrtc.SdpObserver {
            override fun onCreateSuccess(p0: org.webrtc.SessionDescription?) {}
            override fun onSetSuccess() { Log.i(TAG, "Remote SDP answer set successfully.") }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(err: String?) { Log.e(TAG, "Failed to set remote SDP answer: $err") }
        }, sdp)
    }

    fun addRemoteIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidateSdp: String) {
        val candidate = org.webrtc.IceCandidate(sdpMid, sdpMLineIndex, candidateSdp)
        peerConnection?.addIceCandidate(candidate)
    }

    private fun setupDataChannel(dc: org.webrtc.DataChannel) {
        dc.registerObserver(object : org.webrtc.DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) {}
            override fun onStateChange() {
                Log.i(TAG, "DataChannel State changed: ${dc.state()}")
            }
            override fun onMessage(buffer: org.webrtc.DataChannel.Buffer?) {
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
