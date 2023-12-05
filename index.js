const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const http = require('http');
const WebSocket = require('ws');
// readFileSync function must use __dirname get current directory
// require use ./ refer to current directory.


const app = express();
app.use(cors('*'));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;
//Nodes are the message servers
var nodes = [];
//This is responsible for generating our status response!
var nodesStatus = [];
var lazyProvidersStatus = [];//Here we utilize this to keep track of the lazy providers storage status and what node there attached to!
var videonodes = [];
var videonodesStatus = [];
/*
* This will be for the api requesters gateway point later on to be implemented
* to make a true api access point for the whole system! We will be using this for our movie site!
* Also Website Developers can choose to use there own message nodes as access points for their websites!
* So they can easily integrate their websites with the DBlockbuster system!
* They can still get the proper relayed data from the Gateway! from other nodes!
* Without bogging down the whole system by going through their own message nodes instead of the gateway like we will be doing!
*/var requesters = [];//We might implement this in the future! for now they can just use there own message node for there website!

const FACTSOTHER = { msg: 'This is a websocket gateway provided by DBlockbuster! For the msgs to be relayed from nodes to streamers and vice versa!' };

function s(input) {
  if (typeof input !== 'string' && typeof input === 'number') {
    input = input.toString().replace(/\\([0-9a-fA-F]{2})|[\x00-\x1F\x7F-\x9F]|\\u([0-9a-fA-F]{4})|['"|`]|\\/g, '');
    return Number(input);
  }

  if (typeof input !== 'string' && typeof input === 'object') {
    input = input.toString().replace(/\\([0-9a-fA-F]{2})|[\x00-\x1F\x7F-\x9F]|\\u([0-9a-fA-F]{4})|['"|`]|\\/g, '');
    return Object(input);
  }
  if (input !== undefined || null){
  input = input.replace(/\\([0-9a-fA-F]{2})|[\x00-\x1F\x7F-\x9F]|\\u([0-9a-fA-F]{4})|['"|`]|\\/g, '');
  }
  return input;
}

wss.on('connection', ws => {
  console.log('Connection established');

  ws.on('message', message => {
    try {
    const newFact = JSON.parse(message);
    console.log(newFact);
    switch (newFact.connectionType){
      
      case 'node':
        switch (newFact.messageType){
          case 'Initialize':
            //eventsNodeHandler(newFact);
            const randId = Math.random().toString().slice(2, 11);
            const clientId = Date.now() + randId;
            ws.clientId = clientId;
            var factNewOther = {
              type: 'authenticated',
              nodeId: clientId,
              domain: s(newFact.domain),
              port: s(newFact.port),
              msg: FACTSOTHER.msg,
              connectionType: s(newFact.connectionType),
            };
            const newClient = {
              id: clientId,
              domain: s(newFact.domain),
              port: s(newFact.port),
              providers: s(newFact.providersAmount),
              requesters: s(newFact.requestersAmount),
              broadcasters: s(newFact.broadcastersAmount),
              streamers: s(newFact.streamersAmount),
              connectionType: s(newFact.connectionType),
              ws: ws
            };
            nodes.push(newClient);
            const newVideoStatus = {
              id: clientId,
              domain: s(newFact.domain),
              port: s(newFact.port),
              broadcasters: s(newFact.broadcastersAmount),
              streamers: s(newFact.streamersAmount)
            };
            videonodesStatus.push(newVideoStatus);
            const newStatus = {
              id: clientId,
              domain: s(newFact.domain),
              port: s(newFact.port),
              providers: s(newFact.providersAmount),
              requesters: s(newFact.requestersAmount),
            };
            nodesStatus.push(newStatus);
            const newProviderStatus = {
              id: clientId,
              domain: s(newFact.domain),
              port: s(newFact.port),
              providersStatus: s(newFact.providersStatus),
            }
            lazyProvidersStatus.push(newProviderStatus);
            ws.send(JSON.stringify(factNewOther));
          break;

          case 'messageRelay':
            processNodeFacts(newFact.fact);
          break;
        
          case 'providerStatus':
            var index = nodesStatus.findIndex(x => x.id === ws.clientId);
            nodesStatus[index].providers = s(newFact.size);
          break;

          case 'requesterStatus':
            var index = nodesStatus.findIndex(x => x.id === ws.clientId);
            nodesStatus[index].requesters = s(newFact.size);
          break;

          case 'broadcasterStatus':
            var index = videonodesStatus.findIndex(x => x.id === ws.clientId);
            videonodesStatus[index].broadcasters = s(newFact.size);
          break;

          case 'streamerStatus':
            var index = videonodesStatus.findIndex(x => x.id === ws.clientId);
            videonodesStatus[index].streamers = s(newFact.size);
          break;

          case 'lazyProviderStatus':
            var index = lazyProvidersStatus.findIndex(x => x.id === ws.clientId);
            lazyProvidersStatus[index].providersStatus = s(newFact.providersStatus);
          break;

          case 'ping':
            console.log('Ping receieved:', newFact.connectionType, ws.clientId);
            ws.send(JSON.stringify({connectionType:"gateway", messageType:"pong"}));
          break;
        
        
        }
      break;

      case 'client':
        switch (newFact.messageType){
          case 'status':
            var factNewOther = {
              videoNodes: videonodesStatus,
              nodes: nodesStatus,
            }
            ws.send(JSON.stringify(factNewOther));
          break;
          case 'availability':
            //This will return avaliable locations for users to use like which video nodes they can request broadcaster to etc..!
            console.log('VideoNodes:', videonodesStatus);
            console.log('Nodes:', nodesStatus);
            const videoNodes = videonodesStatus.filter(x => x.streamers < 5000 && x.broadcasters < 500);
            const Nodes = nodesStatus.filter(x=> x.requesters<50000 && x.providers <50000);
            var factNewOther = {
              messageType: 'availability',
              videoNodes: videoNodes,
              nodes: Nodes,
            }
            ws.send(JSON.stringify(factNewOther));
          break;
          case 'lazyAvailability':
            const size = newFact.fileSize;
            //This will return avaliable locations for users to use like which video nodes they can request broadcaster to etc..!
            const lazyProviders = lazyProvidersStatus.filter(x => x.filter(y => y.sizeAvailable));
            var factNewOther = {
              messageType: 'lazyAvailability',
              lazyProviders: lazyProviders,
            }
            ws.send(JSON.stringify(factNewOther));
          break;
        }
      break;
    }
  }catch(error){
    console.log('Websocket On Message Error:', error);
  }
    //console.log('nodeMsg:', newFact);
    ///sendToAllNodes(newFact);
  });

  ws.on('close', () => {
    console.log('Connection closed');
    removeClient(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Facts Events service listening at http://localhost:${PORT}`);
});


function removeClient(ws) {
  nodes = nodes.filter(client => client.ws !== ws);
  nodesStatus = nodesStatus.filter(client => client.id !== ws.clientId);
  videonodes = videonodes.filter(client => client.ws !== ws);
  videonodesStatus = videonodesStatus.filter(client => client.id !== ws.clientId);
}

/**
 * Sends events to all message nodes.
 *
 * @param {Object} newFact - The new fact object.
 * @param {string} newFact.nodeId - The ID of the node.
 * @param {string} newFact.type - The type of the fact.
 * @param {string} newFact.fact - The fact itself.
 */
function sendToAllNodes(newFact) {
  var nodeId = newFact.nodeId;
  var Type = newFact.type;
  var Fact = newFact.fact;
  var relayedFact = {
    nodeId: nodeId,
    type: Type,
    fact: Fact
  };
  console.log(relayedFact);

  nodes.forEach(node => {
    if (node.nodeId !== nodeId) {
      console.log('passing msg:', newFact, 'to node:', node.id);
      node.ws.send(JSON.stringify(relayedFact));
    }
  });
}

//app.get('/node', eventsNodeHandler);
//app.get('/videonode', eventsVideoNodeHandler);
//app.get('/requester', eventsRequesterHandler);

/*function addNodeMsg(request, response, next) {
  const newFact = request.body;
  console.log('nodeMsg:', newFact);
  response.json(newFact);
  sendEventsToAllNodes(newFact);
}
*/
//app.post('/nodemsg', addNodeMsg);