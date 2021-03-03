const express = require('express')
const path = require('path')
const dotenv= require('dotenv')
const bodyParser= require('body-parser')
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mysql = require('mysql');
const app = express()

dotenv.config({path:'./config.env'})
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.set('view engine','pug')
app.use(express.static(path.join(__dirname,'public')));
app.use(cookieParser());
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
}));

var server = app.listen(process.env.PORT||3000);
var io = require('socket.io')(server);

var sockets=[]
var indices={}

io.on('connection',function(socket){
    socket.on('joinRooms',(data)=>{
        var con = DBConnection()
        con.connect(function(err) {
            if (err) {
                res.render("error");
                con.end()
            }
            var query= "SELECT Name FROM Rooms WHERE BINARY Uname = '" + data.user + "'"
            con.query(query, function (err, result, fields) {
                if (err) {
                    res.render("error");
                    con.end()
                }
                for (let i = 0; i < result.length; i++) socket.join(result[i].Name)
                if(indices[data.user]==undefined){
                    sockets.push({id:socket.id,name:data.user})
                    indices[data.user]=sockets.length-1
                }
                else sockets[indices[data.user]].id=socket.id
                
                con.end();
                io.to(socket.id).emit('loads')
            });
        });
    })
    socket.on('joinRoom',(data)=>{
        socket.join(returnRoom(data.user,data.friend))
        if(!data.dontPingAgain){
            for (let i = 0; i < sockets.length; i++) {
                if(sockets[i].name==data.friend){
                    io.to(sockets[i].id).emit('newFriend', {user:data.friend,friend:data.user});
                    break;
                }
            }
        }
    })
    socket.on('chatMessage',(data)=>{
        if(data.text=="")return;
        if(data.text.length>10000){
            io.to(returnRoom(data.sender,data.c)).emit('tooBig',{sender:data.sender});
            return;
        }
        var con = DBConnection()
        con.connect(function(err) {
            if (err) {
                res.render("error", {data:err})
                con.end()
            }
            data.text= data.text.replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\\n/g,"\\\\n").replace(/\\r/g,"\\\\r").replace(/\\x1a/g,"\\\\x1a")
            var query = "INSERT INTO Texts VALUES('" + returnRoom(data.sender,data.c) +"', '" + data.sender + "', '" + data.text + "', 'N',NOW())"
            con.query(query, function (err2, result) {
                if (err2) res.render("error", {data:err2})
                con.end();
            });
        });
        io.to(returnRoom(data.sender,data.c)).emit('message',{text:data.text, sentTo:data.c, sender:data.sender})
    })
    socket.on("block",(data)=>{
        var con = DBConnection()
        var bRoom= returnRoom(data.blocker,data.blocked)
        var query="INSERT INTO BlockList VALUES('" + data.blocker +"', '" + data.blocked + "')"
        con.query(query, function (err, result) {
            if (err) {
                res.render("error",{data:err});;
                con.end()
            }
            io.to(bRoom).emit("blocker", {blocker:data.blocker, blocked:data.blocked})
            socket.leave(bRoom)
            con.end()
        });
    })
    socket.on("read",(data)=>{
        var con = DBConnection()
        con.connect(function(err) {
            if (err) {
                res.render("error")
                con.end();
            }
            var query = "UPDATE Texts SET Readed = 'Y' WHERE BINARY Room = '" + returnRoom(data.sender,data.sentTo) +"' AND BINARY Sender='"+ data.sender +"'";
            con.query(query, function (err2, result) {
                if (err2) {
                    res.render("error")
                    con.end();
                }
                con.end();
            });
        });
    })
})

app.get('/',(req,res)=>{
    if(req.session.userId)res.redirect("/chat")
    else res.render("home")
})
app.post('/',(req,res)=>{
    var info= req.body;
    if(info.id.length>15||info.id.length==0){
        res.send({res:"bu",id:info.id,pass:info.pass})
        return;
    }
    else if(info.pass.length>15||info.pass.length<8){
        res.send({res:"bp",id:info.id,pass:info.pass})
        return;
    }
    var con = DBConnection()
    con.connect(function(err) {
        if (err) {
            res.render("error");;
            con.end()
        }
        var query="SELECT * FROM Users WHERE BINARY Name = '" + info.id + "'"
        con.query(query, function (err, result, fields) {
            if (err) {
                res.render("error");
                con.end()
            }
            if(result.length!=0){
                if(info.signUp=='true'){
                    res.send({res:"ut",id:info.id,pass:info.pass})
                    con.end()
                }
                else{
                    if(result[0].Password!=info.pass){
                        res.send({res:"wp",id:info.id,pass:info.pass})
                        con.end()
                    }
                    else {
                        cacheData(req,info.id)
                        res.send("lool")
                        con.end()
                    }
                }
            }
            else{
                if(info.signUp=='true'){
                    if(info.id.match(/[-!@#$%^&*()+=,/'";:}<>?>`~{]/gi)){
                        res.send({res:"bu",id:info.id,pass:info.pass})
                        con.end()
                    }
                    else if(info.pass.match(/[-_!@#$%^&*()+=,/'";:}<>?>`~{]/gi)){
                        res.send({res:"bp", id:info.id,pass:info.pass})
                        con.end()
                    }
                    else{
                        var iQuery="INSERT INTO Users VALUES('" + info.id +"', '" + info.pass + "')"
                        con.query(iQuery, function (err, result) {
                            if (err) {
                                res.render("error",{data:err});
                                con.end()
                            }
                            cacheData(req,info.id)
                            res.send("lool")
                            con.end();
                        });
                    }
                }
                else {
                    res.send({res:"wp",id:info.id,pass:info.pass})
                    con.end()
                }
            }
        });
    });
})
app.get('/chat',(req,res)=>{
    if(!req.session.userId){
        res.redirect("/")
        return;
    }
    var con = DBConnection()
    var query="SELECT * FROM BlockList WHERE BINARY Blocker = '" + req.session.userId + "'";
    con.query(query, function (err, result, fields) {
        if (err) {
            res.render("error");
            con.end()
        }
        var bList=[];
        for (let i = 0; i < result.length; i++)bList.push(result[i].Blocked);

        query="SELECT Name FROM Rooms WHERE BINARY UName = '" + req.session.userId + "'";
        con.query(query, function (err2, result2, fields) {
            if (err2) {
                res.render("error");
                con.end()
            }
            var rooms=[];
            for (let i = 0; i < result2.length; i++)if(!bList.includes(result2.Name))rooms.push(result2[i].Name);
            res.render('chat',{user:req.session.userId, rooms:rooms, bList:bList})
            con.end()
        });
    });
})
app.post('/chat',(req,res)=>{
    if(!req.session.userId){
        res.redirect("/")
        return;
    }
    var info= req.body;
    var con = DBConnection()
    con.connect(function(err) {
        if(info.user==info.friend){
            con.end()
            res.send({res:"same"})
            return;
        }
        if(info.friend==""){
            con.end()
            res.send({res:"ghost"})
            return;
        }
        if(err){
            res.send("error")
            con.end()
        }

        var query= "SELECT * FROM Users WHERE BINARY Name='" + info.friend + "'"
        var aRoom= returnRoom(info.user,info.friend)
        con.query(query, function (err1, result, fields) {
            if (err1) {
                res.render("error");
                con.end()
            }
            if(result.length==0){
                res.send({res:"ghost"});
                con.end()
                return;
            }
            else{
                query= "SELECT * FROM Rooms WHERE BINARY Name='" + aRoom + "'"
                con.query(query, function (err2, result2, fields2) {
                    if(err2){
                        res.render("error");
                        con.end(0)
                    }
                    if(result2.length==0){
                        var query2 = "INSERT INTO Rooms (Name, Uname) VALUES ?";
                        var values=[[aRoom,info.user],[aRoom, info.friend]]
                        con.query(query2, [values], function (err3, result3) {
                            if (err3) return res.send({res:"error"})
                            con.end();
                            return res.send({res:"sent", room:aRoom})
                        });
                    }
                    else {
                        res.send({res:"redundant"})
                        con.end()
                    }
                })
            }
        })
    });
})
app.post('/loads',(req,res)=>{
    if(!req.session.userId)return;
    var info=req.body;
    var con = DBConnection()
    con.connect(function(err) {
        if (err) {
            con.end()
            res.render("error");
        }
        var query= "SELECT DISTINCT Name FROM Rooms WHERE BINARY Uname='" + info.user + "'"
        con.query(query, function (err1, result1, fields1) {
            var ret = [];
            for (let i = 0; i < result1.length; i++) {
                if (err1) res.render("error");
                query= "SELECT Sender,Text,Time,Readed FROM Texts WHERE BINARY Room='" + result1[i].Name + "' ORDER BY Time"// LIMIT " + 20
                con.query(query, function (err2, result2, fields2) {
                    if (err2)  {
                        con.end()
                        res.render("error");
                    }
                    ret.push({room:result1[i].Name, records:result2})
                    if(i==result1.length-1) {
                        con.end()
                        res.send(ret);
                    }
                });
            }
        });
    });
})
app.get("/logout",(req,res)=>{
    req.session.userId=undefined;
    res.redirect("/")
})

function cacheData(req,id){req.session.userId=id;}
function returnRoom(u,f){
    var rA= [u,f]
    rA.sort();
    return rA.join("-")
}
function DBConnection(){
    return mysql.createConnection({
        host: "bgkbzb6s0azl9nt55rk0-mysql.services.clever-cloud.com",
        user: "uwvnqwcwlqkbase1",
        password: "bV5G52qtesPOHX0c68fh",
        database:"bgkbzb6s0azl9nt55rk0"
    });
}
// function DBConnection(){
//     return mysql.createConnection({
//         host: "localhost",
//         user: "root",
//         password: "wamedoo5",
//         database:"gchat"
//     });
// }