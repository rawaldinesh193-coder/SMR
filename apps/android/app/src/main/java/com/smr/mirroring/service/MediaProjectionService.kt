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
                videoCapturer = ScreenCapturerAndroid(resultData, object : MediaProjection.Callback() {
                    override fun onStop() {
                        Log.i(TAG, "MediaProjection stopped by user or system")
                        stopSelf()
                    }
                })
                Log.i(TAG, "ScreenCapturerAndroid successfully instantiated.")
            } catch (e: Exception) {
                Log.e(TAG, "Error initializing ScreenCapturerAndroid", e)
            }
        } else {
            Log.e(TAG, "Invalid resultCode or resultData for MediaProjection")
        }

        return START_NOT_STICKY
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
        Log.i(TAG, "MediaProjectionService destroyed")
    }

    private fun startForegroundServiceNotification() {
        val channelId = "smr_projection_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Screen Mirroring Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active screen mirroring session notification"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("SMR Screen Mirroring Active")
            .setContentText("Phone screen is currently being mirrored to paired laptop")
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
    }
}
