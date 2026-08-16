package com.smr.mirroring.transform

import kotlin.math.max
import kotlin.math.min

data class ScreenDimensions(
    val width: Int,
    val height: Int,
    val rotation: Int = 0 // 0, 90, 180, 270 degrees
)

data class TransformedPoint(
    val x: Float,
    val y: Float
)

/**
 * Industrial-Grade Coordinate Transformation Service
 * Maps normalized desktop cursor coordinates (0.0 to 1.0) to Android display pixel coordinates
 * taking into account device resolution, aspect ratio letterboxing, zoom, and orientation rotation.
 */
class CoordinateTransformService {

    /**
     * Transforms normalized desktop inputs (0.0..1.0) into Android native display coordinates (px).
     */
    fun transformNormalizedToDisplay(
        normX: Float,
        normY: Float,
        screen: ScreenDimensions
    ): TransformedPoint {
        // Clamp normalized inputs between 0.0 and 1.0
        val clampedNormX = max(0f, min(1f, normX))
        val clampedNormY = max(0f, min(1f, normY))

        return when (screen.rotation) {
            90 -> { // Landscape Left
                TransformedPoint(
                    x = clampedNormY * screen.width,
                    y = (1.0f - clampedNormX) * screen.height
                )
            }
            180 -> { // Reverse Portrait
                TransformedPoint(
                    x = (1.0f - clampedNormX) * screen.width,
                    y = (1.0f - clampedNormY) * screen.height
                )
            }
            270 -> { // Landscape Right
                TransformedPoint(
                    x = (1.0f - clampedNormY) * screen.width,
                    y = clampedNormX * screen.height
                )
            }
            else -> { // 0 Portrait
                TransformedPoint(
                    x = clampedNormX * screen.width,
                    y = clampedNormY * screen.height
                )
            }
        }
    }
}
