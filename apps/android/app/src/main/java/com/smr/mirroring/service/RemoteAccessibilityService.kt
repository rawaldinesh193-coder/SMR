package com.smr.mirroring.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Path
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.smr.mirroring.transform.CoordinateTransformService
import com.smr.mirroring.transform.ScreenDimensions

class RemoteAccessibilityService : AccessibilityService() {

    private val transformService = CoordinateTransformService()
    private var lastTouchX: Float = 0f
    private var lastTouchY: Float = 0f

    private val inputReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent ?: return
            val action = intent.getStringExtra("ACTION") ?: return
            val displayMetrics = resources.displayMetrics
            val screen = ScreenDimensions(
                width = displayMetrics.widthPixels,
                height = displayMetrics.heightPixels,
                rotation = 0
            )

            when (action) {
                "TAP", "TOUCH_DOWN", "TOUCH_MOVE", "TOUCH_UP" -> {
                    val normX = intent.getFloatExtra("NORM_X", 0.5f)
                    val normY = intent.getFloatExtra("NORM_Y", 0.5f)
                    val pt = transformService.transformNormalizedToDisplay(normX, normY, screen)

                    if (action == "TAP") {
                        performTap(pt.x, pt.y)
                    } else {
                        handleTouchGesture(action, pt.x, pt.y)
                    }
                }
                "LONG_PRESS" -> {
                    val normX = intent.getFloatExtra("NORM_X", 0.5f)
                    val normY = intent.getFloatExtra("NORM_Y", 0.5f)
                    val pt = transformService.transformNormalizedToDisplay(normX, normY, screen)
                    performLongPress(pt.x, pt.y)
                }
                "SWIPE" -> {
                    val startX = intent.getFloatExtra("START_X", 0.5f)
                    val startY = intent.getFloatExtra("START_Y", 0.5f)
                    val endX = intent.getFloatExtra("END_X", 0.5f)
                    val endY = intent.getFloatExtra("END_Y", 0.5f)
                    val duration = intent.getLongExtra("DURATION", 300L)

                    val p1 = transformService.transformNormalizedToDisplay(startX, startY, screen)
                    val p2 = transformService.transformNormalizedToDisplay(endX, endY, screen)
                    performSwipe(p1.x, p1.y, p2.x, p2.y, duration)
                }
                "GLOBAL_ACTION" -> {
                    val actionName = intent.getStringExtra("GLOBAL_ACTION_NAME") ?: ""
                    val globalCode = when (actionName) {
                        "BACK" -> GLOBAL_ACTION_BACK
                        "HOME" -> GLOBAL_ACTION_HOME
                        "RECENTS" -> GLOBAL_ACTION_RECENTS
                        "NOTIFICATIONS" -> GLOBAL_ACTION_NOTIFICATIONS
                        "QUICK_SETTINGS" -> GLOBAL_ACTION_QUICK_SETTINGS
                        "POWER_DIALOG" -> GLOBAL_ACTION_POWER_DIALOG
                        "LOCK_SCREEN" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) GLOBAL_ACTION_LOCK_SCREEN else GLOBAL_ACTION_POWER_DIALOG
                        "TAKE_SCREENSHOT" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) GLOBAL_ACTION_TAKE_SCREENSHOT else GLOBAL_ACTION_NOTIFICATIONS
                        else -> intent.getIntExtra("GLOBAL_ACTION_TYPE", GLOBAL_ACTION_BACK)
                    }
                    performGlobalAction(globalCode)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        val filter = IntentFilter("com.smr.mirroring.REMOTE_INPUT")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(inputReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(inputReceiver, filter)
        }
        Log.i(TAG, "RemoteAccessibilityService initialized and listening for remote input gestures.")
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(inputReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receiver", e)
        }
        instance = null
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {
        Log.w(TAG, "RemoteAccessibilityService interrupted.")
    }

    private fun performTap(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x + 2f, y + 2f)
        }
        dispatchStroke(path, duration = 120L)
    }

    private fun performLongPress(x: Float, y: Float) {
        val path = Path().apply {
            moveTo(x, y)
            lineTo(x + 2f, y + 2f)
        }
        dispatchStroke(path, duration = 1000L)
    }

    private fun performSwipe(startX: Float, startY: Float, endX: Float, endY: Float, duration: Long) {
        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        dispatchStroke(path, duration = duration)
    }

    private fun handleTouchGesture(action: String, x: Float, y: Float) {
        val path = Path()
        when (action) {
            "TOUCH_DOWN" -> {
                path.moveTo(x, y)
                path.lineTo(x + 2f, y + 2f)
                lastTouchX = x
                lastTouchY = y
                dispatchStroke(path, duration = 80L)
            }
            "TOUCH_MOVE" -> {
                path.moveTo(lastTouchX, lastTouchY)
                path.lineTo(x, y)
                lastTouchX = x
                lastTouchY = y
                dispatchStroke(path, duration = 40L)
            }
            "TOUCH_UP" -> {
                path.moveTo(lastTouchX, lastTouchY)
                path.lineTo(x, y)
                dispatchStroke(path, duration = 30L)
            }
        }
    }

    private fun dispatchStroke(path: Path, duration: Long) {
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                super.onCompleted(gestureDescription)
                Log.d(TAG, "Gesture stroke executed successfully")
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                super.onCancelled(gestureDescription)
                Log.w(TAG, "Gesture stroke cancelled")
            }
        }, null)
    }

    companion object {
        private const val TAG = "RemoteAccessibility"
        var instance: RemoteAccessibilityService? = null
            private set

        fun isEnabled(): Boolean = instance != null
    }
}
