package com.smr.mirroring.ui

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smr.mirroring.data.ServerConfigManager
import com.smr.mirroring.service.RemoteAccessibilityService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

enum class AppState {
    IDLE,
    PAIRING,
    WAITING_APPROVAL,
    CONNECTED,
    DISCONNECTED
}

data class MainUiState(
    val appState: AppState = AppState.IDLE,
    val pairingCode: String = "",
    val pairingUrl: String = "",
    val desktopName: String = "",
    val statusMessage: String = "Ready to pair",
    val accessibilityEnabled: Boolean = false,
    val pairingSessionId: String = "",
    val androidJwt: String = ""
)

class MainViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        checkPermissions()
    }

    fun checkPermissions() {
        val accEnabled = RemoteAccessibilityService.isEnabled()
        _uiState.value = _uiState.value.copy(accessibilityEnabled = accEnabled)
    }

    fun generatePairingSession(context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                withContext(Dispatchers.Main) {
                    _uiState.value = _uiState.value.copy(
                        statusMessage = "Connecting to server..."
                    )
                }

                val serverUrl = ServerConfigManager(context).getServerUrl()
                val apiUrl = URL("$serverUrl/api/v1/pairing/create")
                val connection = (apiUrl.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                    connectTimeout = 10000
                    readTimeout = 10000
                }

                val jsonBody = JSONObject().apply {
                    put("deviceInfo", JSONObject().apply {
                        put("deviceId", android.os.Build.MODEL)
                        put("brand", android.os.Build.BRAND)
                        put("fingerprint", android.os.Build.FINGERPRINT)
                    })
                }

                connection.outputStream.use { os ->
                    os.write(jsonBody.toString().toByteArray(Charsets.UTF_8))
                }

                if (connection.responseCode == 201 || connection.responseCode == 200) {
                    val responseStr = connection.inputStream.bufferedReader().use { it.readText() }
                    val resJson = JSONObject(responseStr)
                    val data = resJson.getJSONObject("data")
                    
                    val pairingCode = data.getString("pairingCode")
                    val pairingSessionId = data.getString("pairingSessionId")
                    val pairingUrl = data.optString("pairingUrl", "$serverUrl/pair?code=$pairingCode")
                    val androidJwt = data.optString("androidJwt", "")

                    withContext(Dispatchers.Main) {
                        _uiState.value = _uiState.value.copy(
                            appState = AppState.PAIRING,
                            pairingCode = pairingCode,
                            pairingUrl = pairingUrl,
                            pairingSessionId = pairingSessionId,
                            androidJwt = androidJwt,
                            statusMessage = "Pairing Code Active. Enter code on laptop UI."
                        )
                    }
                } else {
                    val fallbackCode = "SMR-" + (1000..9999).random()
                    withContext(Dispatchers.Main) {
                        _uiState.value = _uiState.value.copy(
                            appState = AppState.PAIRING,
                            pairingCode = fallbackCode,
                            pairingUrl = "$serverUrl/pair?code=$fallbackCode",
                            statusMessage = "Offline Mode Pairing Code"
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("MainViewModel", "Error creating online pairing session", e)
                val fallbackCode = "SMR-" + (1000..9999).random()
                withContext(Dispatchers.Main) {
                    _uiState.value = _uiState.value.copy(
                        appState = AppState.PAIRING,
                        pairingCode = fallbackCode,
                        pairingUrl = "https://smr-kzjz.onrender.com/pair?code=$fallbackCode",
                        statusMessage = "Generated Code. Enter code on laptop UI."
                    )
                }
            }
        }
    }

    fun onPairingRequested(desktopName: String) {
        _uiState.value = _uiState.value.copy(
            appState = AppState.WAITING_APPROVAL,
            desktopName = desktopName,
            statusMessage = "$desktopName wants to connect"
        )
    }

    fun approvePairing() {
        _uiState.value = _uiState.value.copy(
            appState = AppState.CONNECTED,
            statusMessage = "Connected and streaming to ${_uiState.value.desktopName}"
        )
    }

    fun disconnect() {
        _uiState.value = _uiState.value.copy(
            appState = AppState.IDLE,
            pairingCode = "",
            statusMessage = "Disconnected"
        )
    }
}
