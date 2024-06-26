// const mqtt = require('mqtt');

// MQTTブローカーのURL
const brokerUrl = 'mqtt://broker.hivemq.com';

// MQTTクライアントの作成
const client = mqtt.connect(brokerUrl);

// 接続時のイベントハンドラ
client.on('connect', () => {
    console.log('Connected to MQTT broker');

    // 購読するトピックを指定
    const topic = 'KIT/HeartBeat';
    client.subscribe(topic, () => {
        console.log(`Subscribed to topic '${topic}'`);
    });
});

// メッセージを受信したときのイベントハンドラ
 client.on('message', function (topic, message) {
    console.log(`Received message: ${message.toString()} on topic ${topic}`);
    document.getElementById('messages').innerHTML += `<p>Message on ${topic}: ${message.toString()}</p>`;
});

client.on('error', function (err) {
        console.error('Connection error: ', err);
        document.getElementById('messages').innerHTML += `<p>Error: ${err}</p>`;
});
