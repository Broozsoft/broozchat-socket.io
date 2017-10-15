var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var router = express.Router();

app.use(express.static(__dirname + '/'));
app.use(express.static(__dirname + '/assets'));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

mongoose.connect('localhost:27017/broozchat', function () {
    useMongoClient: true
});
mongoose.Promise = global.Promise;

var Schema = mongoose.Schema;

var userDataSchema = new Schema({
    message: String,
    sender: String,
    receiver: String
}, { collection: 'user-data' });

var UserData = mongoose.model('UserData', userDataSchema);

app.get('/chat', function (req, res, next) {
    res.render('index.ejs');
});

var users = {}

io.on('connection', function (socket) {
    //add new user to chat
    socket.on('new user', function (user, callback) {
        if (user in users) {
            callback(false);
        } else {
            callback(true);
            socket.nickname = user;
            users[socket.nickname] = socket;
            io.sockets.emit('usernames', Object.keys(users));
        }
    });
    io.sockets.emit('usernames', Object.keys(users));
    //get user message
    socket.on('message', function (data) {
        //save new message to database
        var item = {
            message: data.message,
            sender: socket.nickname,
            receiver: data.receiver
        };
        var data = new UserData(item);
        data.save();
        //send message to selectec contact
        users[item.receiver].emit('messageContact', item);
        
    });

    //retrive all the messages from database when click on user
    socket.on('contact', function (contact) {
        UserData.find(
            {
                "$or": [
                    {"sender": contact, "receiver":socket.nickname},
                    {"receiver": contact, "sender":socket.nickname},
                ]
            }
        ).then(function (messages) {
           users[socket.nickname].emit('messages', messages, socket.nickname);  
        });
    })
    //when user is diconnected
    socket.on('disconnect', function () {
        if (!socket.nickname) return;
        delete users[socket.nickname];
        UserData.deleteMany({sender:socket.nickname});
        UserData.remove(
            {
                "$or":[
                    {"sender":socket.nickname},
                    {"receiver":socket.nickname}
                ]
            }
            , function (err) {
            if (err){
                console.log(err)
            }
          });
        io.sockets.emit('usernames', Object.keys(users));
    });
});

//setting server port
http.listen(3306, function () {
   // console.log('listning on *:8080');
});