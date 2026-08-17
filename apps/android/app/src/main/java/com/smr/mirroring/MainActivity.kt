package com.smr.mirroring

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smr.mirroring.ui.AppState
import com.smr.mirroring.ui.MainViewModel
import com.smr.mirroring.ui.UiState

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        viewModel.autoStartPersonalSession(this)
        setContent {
            SMRMirroringApp(this, viewModel)
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkPermissions()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 9001) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                viewModel.onScreenCaptureConsentGranted(this, resultCode, data)
            } else {
                viewModel.denyPairing()
            }
        }
    }
}

@Composable
fun SMRMirroringApp(activity: Activity, viewModel: MainViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF020617)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            HeaderSection()

            when (uiState.appState) {
                AppState.IDLE -> IdleContent(viewModel, uiState)
                AppState.PAIRING -> PairingContent(uiState)
                AppState.WAITING_APPROVAL -> ApprovalContent(activity, viewModel, uiState)
                AppState.CONNECTED -> ConnectedContent(viewModel, uiState)
            }

            PermissionBanner(viewModel, uiState)
        }
    }
}

@Composable
fun HeaderSection() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(top = 16.dp)
    ) {
        Text(
            text = "SMR Cyber Mirror",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF00FF66)
        )
        Text(
            text = "Personal Instant Screen Mirroring & Touch Remote",
            fontSize = 12.sp,
            color = Color(0xFF10B981)
        )
    }
}

@Composable
fun IdleContent(viewModel: MainViewModel, uiState: UiState) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .background(Color(0xFF052e16), shape = RoundedCornerShape(36.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("READY", color = Color(0xFF00FF66), fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Personal Phone Auto-Registered",
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Open laptop UI at https://smr-kzjz.onrender.com and tap Instant Connect to mirror screen without codes.",
            fontSize = 13.sp,
            color = Color(0xFF94A3B8),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = uiState.statusMessage,
            fontSize = 12.sp,
            color = Color(0xFF10B981),
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { viewModel.generatePairingSession(context) },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(0.85f).height(50.dp)
        ) {
            Text("Re-Register Session", fontSize = 15.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun PairingContent(uiState: UiState) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "Personal Code (Optional)",
            fontSize = 14.sp,
            color = Color(0xFF94A3B8)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = uiState.pairingCode,
            fontSize = 36.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color(0xFF00FF66),
            letterSpacing = 4.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = uiState.statusMessage,
            fontSize = 12.sp,
            color = Color(0xFF10B981),
            textAlign = TextAlign.Center
        )
    }
}

@Composable
fun ApprovalContent(activity: Activity, viewModel: MainViewModel, uiState: UiState) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF062016)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Instant Connection Request",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "${uiState.desktopName} wants to stream screen and remote control.",
                fontSize = 14.sp,
                color = Color(0xFFCBD5E1),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(24.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                OutlinedButton(
                    onClick = { viewModel.denyPairing() },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Deny", color = Color(0xFFEF4444))
                }
                Button(
                    onClick = { viewModel.approvePairing(activity) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Allow Mirroring", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun ConnectedContent(viewModel: MainViewModel, uiState: UiState) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .background(Color(0xFF065F46), shape = RoundedCornerShape(36.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("LIVE", color = Color(0xFF00FF66), fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Personal Mirroring Active",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = uiState.statusMessage,
            fontSize = 14.sp,
            color = Color(0xFF94A3B8)
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = { viewModel.disconnectSession() },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(0.8f).height(48.dp)
        ) {
            Text("Disconnect Session", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun PermissionBanner(viewModel: MainViewModel, uiState: UiState) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (uiState.accessibilityEnabled) Color(0xFF052e16) else Color(0xFF78350F)
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (uiState.accessibilityEnabled) "Remote Touch Active" else "Enable Remote Touch",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = Color.White
                )
                Text(
                    text = if (uiState.accessibilityEnabled) "AccessibilityService active for touch gesture injection." else "Enable SMR Accessibility Service in system settings to control phone.",
                    fontSize = 11.sp,
                    color = Color(0xFFE2E8F0)
                )
            }
            if (!uiState.accessibilityEnabled) {
                TextButton(onClick = { viewModel.openAccessibilitySettings(context) }) {
                    Text("Enable", color = Color(0xFFFDE047), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
