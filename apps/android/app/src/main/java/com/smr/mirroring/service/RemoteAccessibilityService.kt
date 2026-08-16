package com.smr.mirroring.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Path
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.smr.mirroring.transform.CoordinateTransformService
import com.smr.mirroring.transform.ScreenDimensions

class RemoteAccessibilityService : AccessibilityService() {

    private val transformService = CoordinateTransformService()
    private var lastTouchPath: Path? = null
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
                "TOUCH_DOWN", "TOUCH_MOVE", "TOUCH_UP" -> {
                    val normX = intent.getFloatExtra("NORM_X", 0f)
                    val normY = intent.getFloatExtra("NORM_Y", 0f)
                    val pt = transformService.transformNormalizedToDisplay(normX, normY, screen)
                    handleTouchGesture(action, pt.x, pt.y)
                }
                "GLOBAL_ACTION" -> {
                    val globalActionType = intent.getIntExtra("GLOBAL_ACTION_TYPE", GLOBAL_ACTION_BACK)
                    performGlobalAction(globalActionType)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        val filter = IntentFilter("com.smr.mirroring.REMOTE_INPUT")
        registerReceiver(inputReceiver, filter, RECEIVER_NOT_EXPORTED)
        Log.i(TAG, "RemoteAccessibilityService initialized and listening for remote input gestures.")
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(inputReceiver)
        instance = null
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Required callback
    }

    override fun onInterrupt() {
        Log.w(TAG, "RemoteAccessibilityService interrupted.")
    }

    private fun handleTouchGesture(action: String, x: Float, y: Float) {
        val path = Path()

        when (action) {
            "TOUCH_DOWN" -> {
                path.moveTo(x, y)
                path.lineTo(x + 1f, y + 1f)
                lastTouchX = x
                lastTouchY = y
                dispatchStroke(path, duration = 50L)
            }
            "TOUCH_MOVE" -> {
                path.moveTo(lastTouchX, lastTouchY)
                path.lineTo(x, y)
                lastTouchX = x
                lastTouchY = y
                dispatchStroke(path, duration = 30L)
            }
            "TOUCH_UP" -> {
                path.moveTo(lastTouchX, lastTouchY)
                path.lineTo(x, y)
                dispatchStroke(path, duration = 20L)
            }
        }
    }

    private fun dispatchStroke(path: Path, duration: Long) {
        val stroke = GestureDescription.StrokeDescription(path, 0, duration)
        val gesture = GestureDescription.Builder().addStroke(stroke).build()
        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                super.onCompleted(gestureDescription)
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                super.onCancelled(gestureDescription)
                Log.w(TAG, "Gesture cancelled")
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
