package com.smr.mirroring.media

import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.util.Log
import com.smr.mirroring.service.RemoteAccessibilityService
import org.json.JSONObject
import org.webrtc.*

class WebRtcMediaManager(private val context: Context) {

    private var factory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var videoSource: VideoSource? = null
    private var localVideoTrack: VideoTrack? = null
    private var dataChannel: DataChannel? = null
    private var capturer: ScreenCapturerAndroid? = null
    private val rootEglBase: EglBase = EglBase.create()

    init {
        val initOptions = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(initOptions)

        val encoderFactory = DefaultVideoEncoderFactory(rootEglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(rootEglBase.eglBaseContext)

        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .createPeerConnectionFactory()
    }

    fun startWebRtcSessionWithIntent(
        projectionData: Intent,
        iceServers: List<PeerConnection.IceServer>,
        onSdpOfferCreated: (String) -> Unit,
        onIceCandidateGenerated: (IceCandidate) -> Unit
    ): Boolean {
        return try {
            closeExistingSession()

            val clonedIntent = projectionData.clone() as Intent
            capturer = ScreenCapturerAndroid(clonedIntent, object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.i(TAG, "MediaProjection session stopped by system callback")
                }
            })

            videoSource = factory?.createVideoSource(true)
            val surfaceTextureHelper = SurfaceTextureHelper.create("WebRTCThread", rootEglBase.eglBaseContext)
            capturer?.initialize(surfaceTextureHelper, context, videoSource?.capturerObserver)

            val metrics = context.resources.displayMetrics
            val width = if (metrics.widthPixels > 0) metrics.widthPixels else 1080
            val height = if (metrics.heightPixels > 0) metrics.heightPixels else 1920
            capturer?.startCapture(width, height, 30)

            localVideoTrack = factory?.createVideoTrack("100", videoSource)

            val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
                sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
                continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            }

            peerConnection = factory?.createPeerConnection(rtcConfig, object : PeerConnectionObserverAdapter() {
                override fun onIceCandidate(candidate: IceCandidate?) {
                    candidate ?: return
                    onIceCandidateGenerated(candidate)
                }

                override fun onDataChannel(dc: DataChannel?) {
                    dc ?: return
                    dataChannel = dc
                    setupDataChannel(dc)
                }
            })

            localVideoTrack?.let { track ->
                peerConnection?.addTrack(track, listOf("stream1"))
            }

            val dcInit = DataChannel.Init()
            dataChannel = peerConnection?.createDataChannel("inputEvents", dcInit)
            dataChannel?.let { setupDataChannel(it) }

            val mediaConstraints = MediaConstraints().apply {
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
                mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "false"))
            }

            peerConnection?.createOffer(object : SdpObserverAdapter() {
                override fun onCreateSuccess(sdp: SessionDescription?) {
                    sdp ?: return
                    peerConnection?.setLocalDescription(object : SdpObserverAdapter() {
                        override fun onSetSuccess() {
                            onSdpOfferCreated(sdp.description)
                        }
                    }, sdp)
                }
            }, mediaConstraints)

            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start WebRTC session safely", e)
            false
        }
    }

    fun setRemoteAnswer(sdpAnswer: String) {
        try {
            val sdp = SessionDescription(SessionDescription.Type.ANSWER, sdpAnswer)
            peerConnection?.setRemoteDescription(SdpObserverAdapter(), sdp)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting remote SDP answer", e)
        }
    }

    fun addRemoteIceCandidate(sdpMid: String, sdpMLineIndex: Int, candidateSdp: String) {
        try {
            val candidate = IceCandidate(sdpMid, sdpMLineIndex, candidateSdp)
            peerConnection?.addIceCandidate(candidate)
        } catch (e: Exception) {
            Log.e(TAG, "Error adding remote ICE candidate", e)
        }
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

    fun parseAndDispatchInputEvent(jsonStr: String) {
        try {
            val json = JSONObject(jsonStr)
            val action = json.optString("action")

            val intent = Intent("com.smr.mirroring.REMOTE_INPUT").apply {
                setPackage(context.packageName)
                putExtra("ACTION", action)
                if (action == "GLOBAL_ACTION") {
                    putExtra("GLOBAL_ACTION_NAME", json.optString("globalAction"))
                } else if (action == "SWIPE") {
                    putExtra("START_X", json.optDouble("startX", 0.5).toFloat())
                    putExtra("START_Y", json.optDouble("startY", 0.5).toFloat())
                    putExtra("END_X", json.optDouble("endX", 0.5).toFloat())
                    putExtra("END_Y", json.optDouble("endY", 0.5).toFloat())
                    putExtra("DURATION", json.optLong("duration", 300L))
                } else {
                    putExtra("NORM_X", json.optDouble("normalizedX", 0.5).toFloat())
                    putExtra("NORM_Y", json.optDouble("normalizedY", 0.5).toFloat())
                }
            }
            context.sendBroadcast(intent)
            RemoteAccessibilityService.instance?.handleDirectInputIntent(intent, context.resources.displayMetrics)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing input packet", e)
        }
    }

    private fun closeExistingSession() {
        try {
            capturer?.stopCapture()
            capturer?.dispose()
            capturer = null
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping capturer", e)
        }
        try {
            dataChannel?.close()
            peerConnection?.close()
            videoSource?.dispose()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing peerConnection", e)
        }
        dataChannel = null
        peerConnection = null
        videoSource = null
    }

    fun close() {
        closeExistingSession()
        try {
            factory?.dispose()
            rootEglBase.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing WebRtcMediaManager", e)
        }
    }

    companion object {
        private const val TAG = "WebRtcMediaManager"
    }
}

open class PeerConnectionObserverAdapter : PeerConnection.Observer {
    override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
    override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) {}
    override fun onIceConnectionReceivingChange(p0: Boolean) {}
    override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
    override fun onIceCandidate(p0: IceCandidate?) {}
    override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
    override fun onAddStream(p0: MediaStream?) {}
    override fun onRemoveStream(p0: MediaStream?) {}
    override fun onDataChannel(p0: DataChannel?) {}
    override fun onRenegotiationNeeded() {}
    override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
}

open class SdpObserverAdapter : SdpObserver {
    override fun onCreateSuccess(p0: SessionDescription?) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(p0: String?) {}
    override fun onSetFailure(p0: String?) {}
}
