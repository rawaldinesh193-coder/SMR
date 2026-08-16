import { WebSocketMessageType, WebSocketMessage, InputControlAction, AndroidGlobalAction } from '@smr/protocol';
import { ConnectionDiagnostics } from '@smr/shared-types';

export class WebRtcDesktopClient {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream = new MediaStream();
  private statsInterval: number | null = null;

  public onStreamReceived?: (stream: MediaStream) => void;
  public onDiagnosticsUpdated?: (stats: ConnectionDiagnostics) => void;
  public onStateChanged?: (state: string) => void;

  constructor(private signalingUrl: string) {}

  public async connectAndPair(pairingCodeOrToken: string): Promise<void> {
    this.ws = new WebSocket(this.signalingUrl);

    this.ws.onopen = () => {
      console.log('[Desktop WebRTC] Connected to signaling gateway');
      this.onStateChanged?.('SIGNALING');
      this.sendWs({
        type: WebSocketMessageType.PAIR_REQUEST,
        pairingSessionId: pairingCodeOrToken,
        desktopName: 'Laptop Desktop Client',
        desktopFingerprint: 'DESKTOP-CLIENT-FP-9901'
      });
    };

    this.ws.onmessage = async (event) => {
      const msg: WebSocketMessage = JSON.parse(event.data);

      switch (msg.type) {
        case WebSocketMessageType.PAIR_APPROVAL: {
          console.log('[Desktop WebRTC] Pairing approved by phone!');
          this.onStateChanged?.('CONNECTING');
          await this.initPeerConnection(msg.turnServers || []);
          break;
        }

        case WebSocketMessageType.SDP_OFFER: {
          console.log('[Desktop WebRTC] Received SDP Offer from phone');
          if (this.pc) {
            await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            this.sendWs({
              type: WebSocketMessageType.SDP_ANSWER,
              sessionId: msg.sessionId,
              sdp: answer.sdp!
            });
          }
          break;
        }

        case WebSocketMessageType.ICE_CANDIDATE: {
          if (this.pc && msg.candidate) {
            await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
          break;
        }

        case WebSocketMessageType.PAIR_REJECTED: {
          this.onStateChanged?.('REJECTED');
          break;
        }
      }
    };
  }

  private async initPeerConnection(iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>) {
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.ontrack = (event) => {
      console.log('[Desktop WebRTC] Video track received!');
      event.streams[0].getTracks().forEach((track) => this.mediaStream.addTrack(track));
      this.onStreamReceived?.(this.mediaStream);
      this.onStateChanged?.('CONNECTED');
      this.startDiagnosticsCollector();
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      console.log('[Desktop WebRTC] DataChannel received:', this.dataChannel.label);
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWs({
          type: WebSocketMessageType.ICE_CANDIDATE,
          sessionId: 'active_session',
          candidate: event.candidate.toJSON()
        });
      }
    };
  }

  public sendTouchInput(action: InputControlAction.TOUCH_DOWN | InputControlAction.TOUCH_MOVE | InputControlAction.TOUCH_UP, normX: number, normY: number) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const payload = JSON.stringify({
        action,
        pointerId: 0,
        normalizedX: normX,
        normalizedY: normY,
        timestamp: Date.now()
      });
      this.dataChannel.send(payload);
    }
  }

  public sendGlobalAction(actionType: AndroidGlobalAction) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const payload = JSON.stringify({
        action: InputControlAction.GLOBAL_ACTION,
        globalAction: actionType,
        timestamp: Date.now()
      });
      this.dataChannel.send(payload);
    }
  }

  private startDiagnosticsCollector() {
    this.statsInterval = window.setInterval(async () => {
      if (!this.pc) return;
      const stats = await this.pc.getStats();
      let rttMs = 0;
      let fps = 30;
      let bitrateKbps = 1500;
      let iceState = this.pc.iceConnectionState;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.currentRoundTripTime) {
          rttMs = Math.round(report.currentRoundTripTime * 1000);
        }
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          fps = report.framesPerSecond || 30;
        }
      });

      this.onDiagnosticsUpdated?.({
        rttMs,
        packetLossRate: 0.001,
        jitterMs: 2,
        videoBitrateKbps: bitrateKbps,
        videoFps: fps,
        videoWidth: 1080,
        videoHeight: 1920,
        videoCodec: 'VP8',
        iceState,
        connectionType: 'P2P_DIRECT'
      });
    }, 1000);
  }

  public disconnect() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.dataChannel?.close();
    this.pc?.close();
    this.ws?.close();
    this.onStateChanged?.('DISCONNECTED');
  }

  private sendWs(msg: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
