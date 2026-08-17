package com.smr.mirroring.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import org.webrtc.ScreenCapturerAndroid
import org.webrtc.VideoCapturer

class MediaProjectionService : Service() {

    private val binder = LocalBinder()
    var videoCapturer: VideoCapturer? = null
        private set

    inner class LocalBinder : Binder() {
        fun getService(): MediaProjectionService = this@MediaProjectionService
    }

    override fun onCreate() {
        super.onCreate()
        startForegroundServiceNotification()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundServiceNotification()

        val resultCode = intent?.getIntExtra("EXTRA_RESULT_CODE", Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
        val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent?.getParcelableExtra("EXTRA_RESULT_DATA", Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent?.getParcelableExtra("EXTRA_RESULT_DATA")
        }

        if (resultCode == Activity.RESULT_OK && resultData != null) {
            try {
                cachedResultCode = resultCode
                cachedResultData = resultData

                videoCapturer = ScreenCapturerAndroid(resultData, object : MediaProjection.Callback() {
                    override fun onStop() {
                        Log.i(TAG, "MediaProjection session paused or stopped by system")
                    }
                })
                Log.i(TAG, "ScreenCapturerAndroid instantiated & persistent consent cached.")
            } catch (e: Exception) {
                Log.e(TAG, "Error initializing ScreenCapturerAndroid", e)
            }
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
        try {
            videoCapturer?.stopCapture()
            videoCapturer?.dispose()
        } catch (e: Exception) {
            Log.e(TAG, "Error disposing videoCapturer", e)
        }
        videoCapturer = null
    }

    private fun startForegroundServiceNotification() {
        val channelId = "smr_projection_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "SMR Screen Mirroring Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent background screen mirroring & remote control service"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("SMR Cyber Mirror Active")
            .setContentText("Background Screen Mirroring & Remote Control Ready")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to startForeground with FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION", e)
        }
    }

    companion object {
        private const val TAG = "MediaProjectionService"
        private const val NOTIFICATION_ID = 9901

        var cachedResultCode: Int = Activity.RESULT_CANCELED
            private set
        var cachedResultData: Intent? = null
            private set

        fun hasValidConsent(): Boolean {
            return cachedResultCode == Activity.RESULT_OK && cachedResultData != null
        }
    }
}
