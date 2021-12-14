import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import io from 'socket.io-client';
import logo from './logo.svg';

let bufferSize = 2048,
	context,
	processor,
	input,
	globalStream;

const downsampleBuffer = (buffer, sampleRate, outSampleRate) => {
	if (outSampleRate === sampleRate) {
		return buffer;
	}
	if (outSampleRate > sampleRate) {
		throw new Error(
			'downsampling rate show be smaller than original sample rate'
		);
	}
	var sampleRateRatio = sampleRate / outSampleRate;
	var newLength = Math.round(buffer.length / sampleRateRatio);
	var result = new Int16Array(newLength);
	var offsetResult = 0;
	var offsetBuffer = 0;
	while (offsetResult < result.length) {
		var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		var accum = 0,
			count = 0;
		for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
			accum += buffer[i];
			count++;
		}

		result[offsetResult] = Math.min(1, accum / count) * 0x7fff;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
	}
	return result.buffer;
};

function App() {
	const socket = useRef(null);
	const [transcript, setTranscript] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);

	useEffect(() => {
		setupSocket();
	}, []);

	const setupSocket = () => {
		socket.current = io('http://localhost:3001', {
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: Infinity,
			cors: { origin: '*' },
		});

		socket.current.on('connect', () => {
			console.log('connected');
			socket.current.emit('join', 'Server Connected to Client');
		});

		socket.current.on('messages', function (data) {
			console.log(data);
		});

		socket.current.on('speechData', function (data) {
			// console.log(data.results[0].alternatives[0].transcript);
			// let dataFinal = undefined || data.results[0].isFinal;
			console.log('data>>>>>>', data.results);
			// if (dataFinal === true) {
			// }
			setTranscript(data.results[0].alternatives[0].transcript);
		});
	};

	// const setup = async () => {
	// 	context = new (window.AudioContext || window.webkitAudioContext)({
	// 		// if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
	// 		latencyHint: 'interactive',
	// 	});
	// 	processor = context.createScriptProcessor(bufferSize, 1, 1);
	// 	processor.connect(context.destination);
	// 	context.resume();

	// 	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	// 	globalStream = stream;
	// 	input = context.createMediaStreamSource(stream);
	// 	input.connect(processor);

	// 	processor.onaudioprocess = (e) => {
	// 		microphoneProcess(e);
	// 	};
	// };

	const microphoneProcess = (e) => {
		console.log(e);
		var left = e.inputBuffer.getChannelData(0);
		var left16 = downsampleBuffer(left, 44100, 16000);
		console.log('>>>>>>>>>', left16);
		socket.current.emit('binaryData', left16);
	};

	const start = () => {
		socket.current.emit('startGoogleCloudStream', ''); //init socket Google Speech Connection

		AudioContext = window.AudioContext || window.webkitAudioContext;
		context = new AudioContext({
			// if Non-interactive, use 'playback' or 'balanced' // https://developer.mozilla.org/en-US/docs/Web/API/AudioContextLatencyCategory
			latencyHint: 'interactive',
		});
		processor = context.createScriptProcessor(bufferSize, 1, 1);
		processor.connect(context.destination);
		context.resume();

		var handleSuccess = function (stream) {
			globalStream = stream;
			input = context.createMediaStreamSource(stream);
			input.connect(processor);

			processor.onaudioprocess = function (e) {
				console.log('??????ssssS', e);
				microphoneProcess(e);
			};
		};

		navigator.mediaDevices.getUserMedia({ audio: true }).then(handleSuccess);
		setIsStreaming(true);
	};

	const stop = () => {
		if (isStreaming) {
			// stop record track from browser
			let track = globalStream.getTracks()[0];
			track.stop();

			// stop recorder from browser
			input.disconnect(processor);
			processor.disconnect(context.destination);
			context.close().then(() => {
				input = null;
				processor = null;
				context = null;
				socket.current.emit('endGoogleCloudStream', '');
			});

			setIsStreaming(false);
		}
	};

	return (
		<div className='App'>
			<div>
				<img src={logo} className='App-logo' alt='logo' />
			</div>
			<h1>React-Node-Google Cloud Speech Demo</h1>
			<div>
				<button onClick={start}>Record</button>
				<button onClick={stop}>Stop</button>
			</div>
			<div>
				<textarea value={transcript} readOnly={true} rows='10'></textarea>
			</div>
		</div>
	);
}

export default App;
