const statusEl = document.getElementById('status');
const meVideo = document.getElementById('me');
const peerVideo = document.getElementById('peer');
const findBtn = document.getElementById('findBtn');
const nextBtn = document.getElementById('nextBtn');
const muteBtn = document.getElementById('muteBtn');
const camBtn = document.getElementById('camBtn');

const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${wsProto}://${location.host}`);

let pc = null;
let localStream = null;
let role = null; // 'caller' | 'callee'
let micMuted = false;
let camOff = false;

// STUN + бесплатный публичный TURN (для теста)
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:80?transport=tcp',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

async function getMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  meVideo.srcObject = localStream;
  return localStream;
}

function setStatus(s) { statusEl.textContent = `Статус: ${s}`; }

function closePC() {
  if (pc) {
    try { pc.close(); } catch {}
  }
  pc = null;
}

async function createPC() {
  pc = new RTCPeerConnection({ iceServers });

  const stream = await getMedia();
  stream.getTracks().forEach(t => pc.addTrack(t, stream));

  pc.ontrack = ev => {
    peerVideo.srcObject = ev.streams[0];
  };

  pc.onicecandidate = ev => {
    if (ev.candidate) {
      ws.send(JSON.stringify({ type: 'signal', signal: ev.candidate }));
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('ICE state:', pc.iceConnectionState);
    if (['failed', 'disconnected'].includes(pc.iceConnectionState)) {
      setStatus('связь потеряна');
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('PeerConnection state:', pc.connectionState);
  };
}

async function onMatched(r) {
  role = r;
  setStatus(`подобран собеседник (${role})`);
  await createPC();

  if (role === 'caller') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'signal', signal: offer }));
  }
}

ws.onopen = () => setStatus('онлайн, жду команды');
ws.onclose = () => setStatus('соединение с сервером закрыто');

ws.onmessage = async (e) => {
  const msg = JSON.parse(e.data);

  if (msg.type === 'matched') {
    await onMatched(msg.role);
  } else if (msg.type === 'partner-left') {
    setStatus('собеседник вышел');
    if (peerVideo.srcObject) peerVideo.srcObject = null;
    closePC();
  } else if (msg.type === 'signal') {
    const sig = msg.signal;

    if (sig && sig.type === 'offer') {
      if (!pc) await createPC();
      await pc.setRemoteDescription(new RTCSessionDescription(sig));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: 'signal', signal: answer }));
    } else if (sig && sig.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(sig));
    } else if (sig && sig.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(sig));
      } catch (err) {
        console.warn('ICE add error', err);
      }
    }
  }
};

findBtn.onclick = async () => {
  await getMedia();
  setStatus('поиск собеседника…');
  ws.send(JSON.stringify({ type: 'find' }));
};

nextBtn.onclick = () => {
  if (peerVideo.srcObject) peerVideo.srcObject = null;
  closePC();
  setStatus('поиск следующего…');
  ws.send(JSON.stringify({ type: 'next' }));
};

muteBtn.onclick = () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
  muteBtn.textContent = micMuted ? 'Unmute' : 'Mute';
};

camBtn.onclick = () => {
  if (!localStream) return;
  camOff = !camOff;
  localStream.getVideoTracks().forEach(t => t.enabled = !camOff);
  camBtn.textContent = camOff ? 'Start Cam' : 'Stop Cam';
};
