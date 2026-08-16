package com.smr.mirroring.ui

import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.smr.mirroring.service.RemoteAccessibilityService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.*

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
    val qrBitmap: android.graphics.Bitmap? = null,
    val desktopName: String = "",
    val accessibilityEnabled: Boolean = false,
    val statusMessage: String = "Ready to connect"
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        checkPermissions()
    }

    fun checkPermissions() {
        val accEnabled = RemoteAccessibilityService.isEnabled()
        _uiState.value = _uiState.value.copy(accessibilityEnabled = accEnabled)
    }

    fun generatePairingSession(context: Context) {
        viewModelScope.launch {
            // Mock generate code for UI representation before API connect
            val code = "SMR-" + (1000..9999).random()
            val url = "http://192.168.1.100:4000/pair?code=$code"
            _uiState.value = _uiState.value.copy(
                appState = AppState.PAIRING,
                pairingCode = code,
                pairingUrl = url,
                statusMessage = "Waiting for computer to connect..."
            )
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

    fun denyPairing() {
        _uiState.value = _uiState.value.copy(
            appState = AppState.IDLE,
            statusMessage = "Pairing denied by user"
        )
    }

    fun disconnectSession() {
        _uiState.value = _uiState.value.copy(
            appState = AppState.IDLE,
            statusMessage = "Session disconnected"
        )
    }

    fun openAccessibilitySettings(context: Context) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}
