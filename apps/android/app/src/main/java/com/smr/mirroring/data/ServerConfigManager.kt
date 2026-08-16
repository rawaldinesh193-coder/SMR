package com.smr.mirroring.data

import android.content.Context
import android.content.SharedPreferences

class ServerConfigManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences("smr_server_config", Context.MODE_PRIVATE)

    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun saveServerUrl(url: String) {
        val cleanUrl = url.trim().removeSuffix("/")
        prefs.edit().putString(KEY_SERVER_URL, cleanUrl).apply()
    }

    companion object {
        const val DEFAULT_SERVER_URL = "https://smr-kzjz.onrender.com"
        const val KEY_SERVER_URL = "custom_server_url"
    }
}
