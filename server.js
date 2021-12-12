const express = require('express');
const app = express();
const port = 3001;
const server = require('http').Server(app);
const io = require('socket.io')(server);
const recorder = require('node-record-lpcm16');
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'ko-KR'; //en-US

// Configure Transcription Request
const request = {
	config: {
		encoding: encoding,
		sampleRateHertz: sampleRateHertz,
		languageCode: languageCode,
	},
	interimResults: true,
};

app.get('/', (req, res) => res.send('Hello World!'));

server.listen(port, () =>
	console.log(`Example app listening at http://localhost:${port}`)
);

io.on('connection', (socket) => {
	console.log('new client connected');
	let recognizeStream = null;

	socket.on('join', function () {
		socket.emit('messages', 'Socket Connected to Server');
	});

	socket.on('messages', function (data) {
		socket.emit('broad', data);
	});

	socket.on('startGoogleCloudStream', function (data) {
		console.log('>?????', data);
		startRecognitionStream(this, data);
	});

	socket.on('endGoogleCloudStream', function () {
		stopRecognitionStream();
	});

	socket.on('binaryData', function (data) {
		// console.log(data); //log binary data
		if (recognizeStream !== null) {
			recognizeStream.write(data);
		}
	});

	function startRecognitionStream(client, data) {
		recognizeStream = speechClient
			.streamingRecognize(request)
			.on('error', console.error)
			.on('data', (data) => {
				process.stdout.write(
					data.results[0] && data.results[0].alternatives[0]
						? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
						: `\n\nReached transcription time limit, press Ctrl+C\n`
				);

				client.emit('speechData', data);

				// if end of utterance, let's restart stream
				// this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
				if (data.results[0] && data.results[0].isFinal) {
					stopRecognitionStream();
					startRecognitionStream(client);
					// console.log('restarted stream serverside');
				}
			});
	}

	function stopRecognitionStream() {
		if (recognizeStream) {
			recognizeStream.end();
		}
		recognizeStream = null;
	}
});
