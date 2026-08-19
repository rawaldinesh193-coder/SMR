package com.smr.mirroring.network

import android.util.Log
import okhttp3.*
import org.json.JSONObject

class SignalingClient(private val serverUrl: String) {

    private val client = OkHttpClient()
    private var webSocket: WebSocket? = null
    var onMessageReceived: ((JSONObject) -> Unit)? = null
    var onConnected: (() -> Unit)? = null
    var onDisconnected: (() -> Unit)? = null

    fun connect(jwtToken: String, deviceId: String) {
        val request = Request.Builder()
            .url(serverUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "Signaling WebSocket connected. Sending AUTH_REQUEST for $deviceId.")
                val authMsg = JSONObject().apply {
                    put("type", "AUTH_REQUEST")
                    put("token", jwtToken)
                    put("role", "android")
                    put("deviceId", deviceId)
                    put("deviceInfo", JSONObject().apply {
                        put("brand", android.os.Build.BRAND)
                        put("model", android.os.Build.MODEL)
                    })
                }
                webSocket.send(authMsg.toString())
                onConnected?.invoke()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val json = JSONObject(text)
                    onMessageReceived?.invoke(json)
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing WebSocket frame", e)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "Signaling WebSocket closing: $reason")
                onDisconnected?.invoke()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "Signaling WebSocket failure", t)
                onDisconnected?.invoke()
            }
        })
    }

    fun sendMessage(json: JSONObject) {
        webSocket?.send(json.toString())
    }

    fun disconnect() {
        webSocket?.close(1000, "User Initiated Disconnect")
        webSocket = null
    }

    companion object {
        private const val TAG = "SignalingClient"
    }
}
