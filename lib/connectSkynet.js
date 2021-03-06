var when = require('when');

var skynet = require('skynet');

var subdevices = require('./subdevices');
var remoteConfig = require('./remoteConfig');

var registerRetries = 0;
var retriesMax = 10;

function connect(gatewayId, token){
  var defer = when.defer();

  var skynetConfig = {
    uuid: gatewayId,
    token: token,
    server: process.env.SKYNET_SERVER,
    port: process.env.SKYNET_PORT
  };

  console.log('connecting to skynet with', skynetConfig);

  var conn = skynet.createConnection(skynetConfig);

  var handlersRegistered = false;



  conn.on('notReady', function(data){
    console.log('UUID FAILED AUTHENTICATION!', data);
    // Register device
    conn.register({
      uuid: gatewayId,
      token: token,
      type: 'gateway'
    }, function (data) {
      console.log('registered', data);
      conn.emit('ready', data);
      defer.resolve(conn);
    });
  });

  conn.on('ready', function(data){
    defer.resolve(conn);
    console.log('UUID AUTHENTICATED!', data);

    if(!handlersRegistered){
      conn.on('message', function(data, fn){
        console.log('message received data=', data);
        if(data.devices == gatewayId){
          console.log('message for gateway');

          try{
            console.log(data);
            if(typeof data == "string"){
              data = JSON.parse(data);
            }

            if(data.subdevice){
              console.log('looking for subdevice',data.subdevice);
              var instance = subdevices.instances[data.subdevice];

              if(instance){
                console.log('matching subdevice found!', instance);
                instance.onMessage(data, fn);
              }
            }else{
              if(fn){
                console.log('responding');
                data.ack = true;
                fn(data);
              }
            }

          }catch(exp){
            console.log('err dispatching message', exp);
          }

        }

      });

      // handle gateway configuration requests
      conn.on('config', function(data, cb, cb2){
        console.log('config api call received:', data, cb, cb2);
        remoteConfig(token, data, cb);
      });

      handlersRegistered = true;

    }else{
      console.log('hanlders already registered, just reconnected to skynet');
    }



    // Event triggered when device loses connection to skynet
    conn.on('disconnect', function(data){
      console.log('disconnected from skynet');
    });



    //WhoAmI?
    conn.whoami({uuid:gatewayId}, function (data) {
      console.log('whoami', data);
    });



  });

  return defer.promise;


}

module.exports = connect;
