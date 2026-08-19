package com.smr.mirroring.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.provider.Settings
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smr.mirroring.data.ServerConfigManager
import com.smr.mirroring.media.WebRtcMediaManager
import com.smr.mirroring.network.SignalingClient
import com.smr.mirroring.service.MediaProjectionService
import com.smr.mirroring.service.RemoteAccessibilityService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.webrtc.PeerConnection
import java.net.HttpURLConnection
import java.net.URL

enum class AppState {
    IDLE,
    PAIRING,
    WAITING_APPROVAL,
    CONNECTED
}

data class UiState(
    val appState: AppState = AppState.IDLE,
    val pairingCode: String = "",
    val pairingUrl: String = "",
    val desktopName: String = "Laptop Console",
    val statusMessage: String = "Ready for Connection",
    val accessibilityEnabled: Boolean = false,
    val pairingSessionId: String = "personal_session",
    val androidJwt: String = "",
    val deviceId: String = ""
)

class MainViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var signalingClient: SignalingClient? = null
    private var webRtcMediaManager: WebRtcMediaManager? = null

    init {
        checkPermissions()
    }

    fun checkPermissions() {
        val accEnabled = RemoteAccessibilityService.isEnabled()
        _uiState.value = _uiState.value.copy(accessibilityEnabled = accEnabled)
    }

    private fun getUniqueDeviceId(context: Context): String {
        val androidId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        } catch (e: Exception) { "" }
        val modelClean = android.os.Build.MODEL.replace(Regex("[^a-zA-Z0-9]"), "_")
        return "phone_${modelClean}_${androidId.takeLast(6)}"
    }

    fun autoStartPersonalSession(context: Context) {
        val uniqueDevId = getUniqueDeviceId(context)
        _uiState.value = _uiState.value.copy(deviceId = uniqueDevId)

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val serverUrl = ServerConfigManager(context).getServerUrl()
                val apiUrl = URL("$serverUrl/api/v1/pairing/create")
                val connection = (apiUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                    connectTimeout = 5000
                    readTimeout = 5000
                }

                val jsonBody = JSONObject().apply {
                    put("deviceInfo", JSONObject().apply {
                        put("deviceId", uniqueDevId)
                        put("brand", android.os.Build.BRAND)
                        put("model", android.os.Build.MODEL)
                    })
                }

                connection.outputStream.use { os ->
                    os.write(jsonBody.toString().toByteArray(Charsets.UTF_8))
                }

                val responseCode = connection.responseCode
                if (responseCode == 200 || responseCode == 201) {
                    val responseStr = connection.inputStream.bufferedReader().use { it.readText() }
                    val resJson = JSONObject(responseStr)
                    val data = resJson.getJSONObject("data")

                    val pairingCode = data.optString("pairingCode", "SMR-88")
                    val pairingSessionId = data.optString("pairingSessionId", "multi_session")
                    val androidJwt = data.optString("androidJwt", "")

                    withContext(Dispatchers.Main) {
                        _uiState.value = _uiState.value.copy(
                            pairingCode = pairingCode,
                            pairingSessionId = pairingSessionId,
                            androidJwt = androidJwt,
                            statusMessage = "Phone Registered ($uniqueDevId). Ready to stream."
                        )
                        connectSignaling(serverUrl, androidJwt, pairingSessionId, uniqueDevId, context)
                    }
                }
            } catch (e: Exception) {
                Log.e("MainViewModel", "Error in auto-start personal session", e)
            }
        }
    }

    fun generatePairingSession(context: Context) {
        autoStartPersonalSession(context)
    }

    private fun connectSignaling(serverUrl: String, jwtToken: String, sessionId: String, deviceId: String, context: Context) {
        val wsProtocol = if (serverUrl.startsWith("https")) "wss:" else "ws:"
        val host = serverUrl.replace(Regex("^https?://"), "").removeSuffix("/")
        val wsUrl = "$wsProtocol//$host/ws/signaling"

        signalingClient?.disconnect()
        signalingClient = SignalingClient(wsUrl).apply {
            onMessageReceived = { json ->
                val type = json.optString("type")
                when (type) {
                    "PAIR_REQUEST" -> {
                        val desktopName = json.optString("desktopName", "Laptop Console")
                        viewModelScope.launch(Dispatchers.Main) {
                            onPairingRequested(desktopName, context)
                        }
                    }
                    "SDP_ANSWER" -> {
                        val sdp = json.optString("sdp")
                        webRtcMediaManager?.setRemoteAnswer(sdp)
                    }
                    "ICE_CANDIDATE" -> {
                        val candidateObj = json.optJSONObject("candidate")
                        if (candidateObj != null) {
                            val mid = candidateObj.optString("sdpMid", "")
                            val mLineIndex = candidateObj.optInt("sdpMLineIndex", 0)
                            val sdp = candidateObj.optString("candidate", "")
                            webRtcMediaManager?.addRemoteIceCandidate(mid, mLineIndex, sdp)
                        }
                    }
                    "REMOTE_INPUT" -> {
                        val payload = json.optJSONObject("payload")
                        if (payload != null) {
                            webRtcMediaManager?.parseAndDispatchInputEvent(payload.toString())
                        }
                    }
                }
            }
            connect(jwtToken)
        }
    }

    fun onPairingRequested(desktopName: String, context: Context) {
        _uiState.value = _uiState.value.copy(
            appState = AppState.WAITING_APPROVAL,
            desktopName = desktopName,
            statusMessage = "$desktopName is connecting..."
        )
        if (MediaProjectionService.hasValidConsent()) {
            onScreenCaptureConsentGranted(
                context,
                MediaProjectionService.cachedResultCode,
                MediaProjectionService.cachedResultData!!
            )
        }
    }

    fun approvePairing(activity: Activity) {
        if (MediaProjectionService.hasValidConsent()) {
            Log.i("MainViewModel", "Reusing cached persistent screen capture consent token")
            onScreenCaptureConsentGranted(
                activity,
                MediaProjectionService.cachedResultCode,
                MediaProjectionService.cachedResultData!!
            )
        } else {
            val projectionManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            activity.startActivityForResult(projectionManager.createScreenCaptureIntent(), 9001)
        }
    }

    fun onScreenCaptureConsentGranted(context: Context, resultCode: Int, data: Intent) {
        try {
            val serviceIntent = Intent(context, MediaProjectionService::class.java).apply {
                putExtra("EXTRA_RESULT_CODE", resultCode)
                putExtra("EXTRA_RESULT_DATA", data)
            }
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                Log.w("MainViewModel", "Could not start foreground service safely: ${e.message}")
            }

            if (webRtcMediaManager == null) {
                webRtcMediaManager = WebRtcMediaManager(context)
            }

            val iceServers = listOf(
                PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
                PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer(),
                PeerConnection.IceServer.builder("stun:stun2.l.google.com:19302").createIceServer(),
                PeerConnection.IceServer.builder("stun:global.stun.twilio.com:3478").createIceServer()
            )

            val currentDevId = _uiState.value.deviceId.ifEmpty { getUniqueDeviceId(context) }

            val sessionStarted = webRtcMediaManager?.startWebRtcSessionWithIntent(
                projectionData = data,
                iceServers = iceServers,
                onSdpOfferCreated = { sdpOfferStr ->
                    val offerMsg = JSONObject().apply {
                        put("type", "SDP_OFFER")
                        put("deviceId", currentDevId)
                        put("pairingSessionId", _uiState.value.pairingSessionId)
                        put("sdp", sdpOfferStr)
                    }
                    signalingClient?.sendMessage(offerMsg)
                },
                onIceCandidateGenerated = { candidate ->
                    val candObj = JSONObject().apply {
                        put("sdpMid", candidate.sdpMid)
                        put("sdpMLineIndex", candidate.sdpMLineIndex)
                        put("candidate", candidate.sdp)
                    }
                    val iceMsg = JSONObject().apply {
                        put("type", "ICE_CANDIDATE")
                        put("deviceId", currentDevId)
                        put("pairingSessionId", _uiState.value.pairingSessionId)
                        put("candidate", candObj)
                    }
                    signalingClient?.sendMessage(iceMsg)
                }
            ) ?: false

            if (!sessionStarted) {
                MediaProjectionService.clearConsent()
                if (context is Activity) {
                    val projectionManager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
                    context.startActivityForResult(projectionManager.createScreenCaptureIntent(), 9001)
                }
                return
            }

            val approvalMsg = JSONObject().apply {
                put("type", "PAIR_APPROVAL")
                put("deviceId", currentDevId)
                put("pairingSessionId", _uiState.value.pairingSessionId)
                put("approved", true)
            }
            signalingClient?.sendMessage(approvalMsg)

            _uiState.value = _uiState.value.copy(
                appState = AppState.CONNECTED,
                statusMessage = "Multi-Device Stream Active ($currentDevId)"
            )
        } catch (e: Exception) {
            Log.e("MainViewModel", "Error starting WebRTC media session", e)
            _uiState.value = _uiState.value.copy(
                statusMessage = "Error starting screen capture: ${e.message}"
            )
        }
    }

    fun denyPairing() {
        val sessionId = _uiState.value.pairingSessionId
        val denyMsg = JSONObject().apply {
            put("type", "PAIR_APPROVAL")
            put("deviceId", _uiState.value.deviceId)
            put("pairingSessionId", sessionId)
            put("approved", false)
        }
        signalingClient?.sendMessage(denyMsg)

        _uiState.value = _uiState.value.copy(
            appState = AppState.IDLE,
            pairingCode = "",
            statusMessage = "Pairing denied"
        )
    }

    fun disconnectSession() {
        signalingClient?.disconnect()
        signalingClient = null
        webRtcMediaManager?.close()
        webRtcMediaManager = null
        _uiState.value = _uiState.value.copy(
            appState = AppState.IDLE,
            pairingCode = "",
            statusMessage = "Disconnected"
        )
    }

    fun openAccessibilitySettings(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e("MainViewModel", "Error opening accessibility settings", e)
        }
    }
}
