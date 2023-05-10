'use strict';

import DID_API from './api.json' assert { type: 'json' };
if (DID_API.key == '🤫') alert('Please put your api key inside ./api.json and restart..')

const RTCPeerConnection = (window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection).bind(window);

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;


const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
  if (peerConnection && peerConnection.connectionState === 'connected') {
    return;
  }

  stopAllStreams();
  closePC();

  const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      source_url: "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.jpeg"
    }),
  });

  
  const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json()
  streamId = newStreamId;
  sessionId = newSessionId;
  
  try {
    sessionClientAnswer = await createPeerConnection(offer, iceServers);
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
    return;
  }

  const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`,
    {
      method: 'POST',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({answer: sessionClientAnswer, session_id: sessionId})
    });
};

const talkButton = document.getElementById('talk-button');
talkButton.onclick = async () => {
  // connectionState not supported in firefox
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    doAudioTalking();
  }};

  const talkTextButton = document.getElementById('text-talk-button');
  talkTextButton.onclick = async () => {
  // connectionState not supported in firefox
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    doTextTalking("Hi! I'm Anna! What's your name?");
  }};

  const helloTextButton = document.getElementById('hello-talk-button');
  helloTextButton.onclick = async () => {
  // connectionState not supported in firefox
  if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
    doTextTalking("Hello, How are you doing today? I hope you are having a nice day");
  }};

const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = async () => {
  await fetch(`${DID_API.url}/talks/streams/${streamId}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({session_id: sessionId})
    });

  stopAllStreams();
  closePC();
};

function doAudioTalking() {
  const talkResponse = fetch(`${DID_API.url}/talks/streams/${streamId}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'script': {
            'type': 'audio',
            'audio_url': 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3',
          },
          'driver_url': 'bank://lively/',
          'config': {
            'stitch': true,
          },
          'session_id': sessionId
        })
      });
}

async function doTextTalking(text) {
  const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'script': {
            'type': 'text',
            'input': text,
          },
          'driver_url': 'bank://lively/',
          'config': {
            'stitch': true,
          },
          'session_id': sessionId
        })
      });
}

function onIceGatheringStateChange() {
  console.log('onIceGatheringStateChange');
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
    
    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`,
      {
        method: 'POST',
        headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id: sessionId})
      }); 
  }
}
function onIceConnectionStateChange() {
  console.log('onIceConnectionStateChange');
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}
function onConnectionStateChange() {
  console.log('onConnectionStateChange');
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  console.log('onSignalingStateChange');
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}
function onTrack(event) {
  console.log('onTrack');
  const remoteStream = event.streams[0];
  console.log(remoteStream);
  setVideoElement(remoteStream);

  remoteStream.addEventListener("addtrack", (event) => {
    console.log('remoteStream.addtrack');
  });

  remoteStream.addEventListener("removetrack", (event) => {
    console.log('remoteStream.removetrack');
  });
}

function onDataChannel(event) {
  console.log('onDataChannel', event);
}


async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({iceServers});
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
    peerConnection.addEventListener('track', onTrack, true);
    console.log('onDataChannel : bind');
    peerConnection.addEventListener('datachannel', onDataChannel);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK');

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo.play().then(_ => {}).catch(e => {});
  }
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach(track => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();
  pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
  pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
  pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
  pc.removeEventListener('track', onTrack, true);
  pc.removeEventListener('datachannel', onDataChannel);
  iceGatheringStatusLabel.innerText = '';
  signalingStatusLabel.innerText = '';
  iceStatusLabel.innerText = '';
  peerStatusLabel.innerText = '';
  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}
