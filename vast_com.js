#!/usr/bin/env node

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var client_socket = {};
var client_instance = {};

const { log: dataLog } = require('vast.js/test/dataCapture.js');
const LogCategory = {
    VAST_COM_INBOUND: 'VAST_COM_INBOUND',
  };

const DEFAULT_PORT = 3456;
const customPort = process.argv[2] || DEFAULT_PORT;

const client = require('vast.js/lib/client');
require('vast.js/lib/common.js');

global.VISUALISE_DEBUG_LOGS = false;
// require('dotenv').config();
const SIZE = 1000; // world size
var C;

io.on('connection', function(socket){
    console.log('a user connected');

    socket.on('handshake', function(uuid, msg){
        console.log('Received handshake: "' + msg + '" from client with UUID: ' + uuid);
        // var uuid = msg.split("UUID: ")[1];
        client_socket[uuid] = socket;
        socket.emit('handshake', 'Hello, client with UUID: ' + uuid + '. This is Node.js Server.');
    });

    socket.on('disconnect', function() {
        console.log('user disconnected');
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        console.log(`Looking up client instance for UUID: ${uuid}`);

        if (client_instance[uuid]) {
            console.log(`Disconnecting client instance for UUID: ${uuid}`);

            // console.log('Client ID: '+client_instance[uuid].getAlias())
            // client_instance[uuid].setAlias("alias")
            // console.log('Client ID: '+client_instance[uuid].getAlias())
            client_instance[uuid].disconnect();
            delete client_instance[uuid];
        } else {
            console.log(`No client instance found for UUID: ${uuid}`);
        }
        delete client_socket[uuid];
    });

    socket.on('spawn_VASTclient', async function(alias, gwHost, gwPort, x, y) {
        console.log('VAST client spawn');
        var r = 10; // radius
        id = generateId();

        if (x === undefined || y === undefined) {
            x = Math.random() * SIZE;
            y = Math.random() * SIZE;
        }

        const C = await createClientAsync(socket, gwHost, gwPort, id, x, y, r);

        console.log('Finished creating client');
        C.setAlias(alias);
        console.log('Finished setting alias');

        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        console.log(`Adding client instance for UUID: ${uuid}`);
        client_instance[uuid] = C;

        socket.emit('log', 'VAST_COM::Client that represents server on VAST has spawned.');
    });

    socket.on('subscribe', function(x, y, radius, channel) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        // client_instance[uuid].subscribe(x, y, radius, channel);
        client_instance[uuid].subscribe({x: x, y: y, radius: radius}, channel);
        // client_instance[uuid].subscribeMobile(radius, channel);
        console.log(`Subscribed to channel '${channel}' at AoI [${x}; ${y}; ${radius}]`);
    });

    socket.on('subscribe_mobile', function(x, y, radius, channel) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        client_instance[uuid].subscribeMobile({x: x, y: y, radius: radius}, channel);
        console.log(`Subscribed to channel '${channel}' with mobile AoI [${radius}]`);
    });

    socket.on('subscribe_mobile_polygon', function(jsonPositions, channel) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);

        // Parse positions from JSON
        const positions = JSON.parse(jsonPositions);

        // Convert positions to the required format
        const points = positions.map(pos => ({x: Math.floor(pos[0]), y: Math.floor(pos[1])}));

        // console.log(points)

        // if (points.length < 15) {
            client_instance[uuid].subscribeMobile(points, channel);
        // }

        console.log(`Subscribed to channel '${channel}' with mobile polygon.`);
    });

    socket.on('subscribe_polygon', function(jsonPositions, channel) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);

        // Parse positions from JSON
        const positions = JSON.parse(jsonPositions);

        // Convert positions to the required format
        const points = positions.map(pos => ({x: Math.floor(pos[0]), y: Math.floor(pos[1])}));

        // console.log(points)

        // if (points.length < 15) {
            client_instance[uuid].subscribe(points, channel);
        // }

        console.log(`Subscribed to channel '${channel}' with polygon.`);
    });

    var tempcounter = 0;
    socket.on('publish', function(connectionID, username, x, y, radius, actualPacket, channel) {

        if (username.split("&")[1]) {
            dataLog(username.split("&")[1], LogCategory.VAST_COM_INBOUND)
        }

        tempcounter += 1
        // console.log('x value: ' + x);
        // console.log('y value: ' + y);
        // console.log('r value: ' + radius);
        // console.log('payload value: ' + payload);
        // console.log('channel: ' + channel);

        // console.log('This is the actaul packet: ' + actualPacket)

        data = {} // should be
        data["connectionID"] = connectionID;
		data["username"] = username;
		data["x"] = x;
		data["y"] = y;
		data["radius"] = radius;
		data["actualPacket"] = actualPacket;
		data["channel"] = channel;


        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        client_instance[uuid].publish(x, y, radius, data, channel);

        // console.log('I have published: ' + tempcounter )

        // console.log(`Published to channel '${channel}' with payload '${data}' at AoI [${x}; ${y}; ${radius}]`);
        // console.log(`Published to channel '${channel}' at AoI [${x}; ${y}; ${radius}]`);
        data = null;

    });

    socket.on('unsubscribe', function(subID) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        client_instance[uuid].unsubscribe(subID);
        console.log(`Unsubscribed from subscription with ID '${subID}'`);
    });

    socket.on('clearSubscriptions', function() {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        client_instance[uuid].clearSubscriptions();
    });


    socket.on('move', function(x, y) {
            const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
            client_instance[uuid].move(x, y);
            console.log(`Moved client to position [${x}; ${y}]`);
            moveCounter = 0;
    });

    socket.on('disconnect_client', function() {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);
        client_instance[uuid].disconnect();
        delete client_instance[uuid];
        console.log('Disconnected client from matcher');
    });

    socket.on('clearsubscriptions', function(channel) {
        const uuid = Object.keys(client_socket).find(key => client_socket[key] === socket);

        if(channel) {
            client_instance[uuid].clearSubscriptions(channel);
            console.log(`Cleared subscription for channel: ${channel}`);
        } else {
            client_instance[uuid].clearSubscriptions();
            console.log('Cleared all subscriptions');
        }
    });


});

http.listen(customPort, function(){
  console.log(`listening on *:${customPort}`);
});

function generateId() {
    let id = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < 5; i++) {
        id += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return id;
}

function createClientAsync(socket, gwHost, gwPort, id, x, y, r) {
    // Return a new promise.
    return new Promise((resolve, reject) => {
        // Do something to create a client instance asynchronously.
        // In this example, we're just simulating an async operation using setTimeout.
        setTimeout(() => {
            const C = new client(gwHost, gwPort, id, x, y, r, function (id) {
                    _id = id;
                    console.log(`Client ${x}, ${y} successfully created with id: ${id}`);
                    let m = C.getMatcherID();
                    console.log(`Assigned to matcher with id ${m}`);
                }, socket);
            console.log('Done?');
            resolve(C);
        }, 0);  // 0 millisecond delay, change to simulate async operation
    });
}
