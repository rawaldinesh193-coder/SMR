package com.smr.mirroring

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

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SMRMirroringApp(viewModel)
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkPermissions()
    }
}

@Composable
fun SMRMirroringApp(viewModel: MainViewModel) {
    val uiState by viewModel.uiState.collectAsState()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFF0F172A)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header
            HeaderSection()

            // Dynamic Body Content based on AppState
            when (uiState.appState) {
                AppState.IDLE -> IdleContent(viewModel, uiState)
                AppState.PAIRING -> PairingContent(uiState)
                AppState.WAITING_APPROVAL -> ApprovalContent(viewModel, uiState)
                AppState.CONNECTED -> ConnectedContent(viewModel, uiState)
            }

            // Footer / Permission status
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
            text = "SMR Mirror",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF38BDF8)
        )
        Text(
            text = "Production Screen Streaming & Remote Control",
            fontSize = 12.sp,
            color = Color(0xFF94A3B8)
        )
    }
}

@Composable
fun IdleContent(viewModel: MainViewModel, uiState: com.smr.mirroring.ui.UiState) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "Connect Phone to Computer",
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Generate a secure QR code or pairing link to stream and control your screen from a laptop.",
            fontSize = 14.sp,
            color = Color(0xFFCBD5E1),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = { viewModel.generatePairingSession(viewModel.getApplication()) },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(0.8f).height(50.dp)
        ) {
            Text("Generate Pairing Code", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun PairingContent(uiState: com.smr.mirroring.ui.UiState) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "Pairing Code",
            fontSize = 14.sp,
            color = Color(0xFF94A3B8)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = uiState.pairingCode,
            fontSize = 36.sp,
            fontWeight = FontWeight.ExtraBold,
            color = Color(0xFF38BDF8),
            letterSpacing = 4.sp
        )
        Spacer(modifier = Modifier.height(24.dp))
        Box(
            modifier = Modifier
                .size(200.dp)
                .background(Color.White, shape = RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("[ QR Code Render ]", color = Color.Black, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Open laptop browser to pair",
            fontSize = 14.sp,
            color = Color(0xFF94A3B8)
        )
    }
}

@Composable
fun ApprovalContent(viewModel: MainViewModel, uiState: com.smr.mirroring.ui.UiState) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Connection Request",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "${uiState.desktopName} wants to mirror and control this phone.",
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
                    onClick = { viewModel.approvePairing() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Allow Connection")
                }
            }
        }
    }
}

@Composable
fun ConnectedContent(viewModel: MainViewModel, uiState: com.smr.mirroring.ui.UiState) {
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
            Text("LIVE", color = Color(0xFF34D399), fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Screen Streaming Active",
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
            Text("Revoke Session & Disconnect", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun PermissionBanner(viewModel: MainViewModel, uiState: com.smr.mirroring.ui.UiState) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (uiState.accessibilityEnabled) Color(0xFF064E3B) else Color(0xFF78350F)
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
                    text = if (uiState.accessibilityEnabled) "Remote Control Enabled" else "Control Needs Permission",
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
