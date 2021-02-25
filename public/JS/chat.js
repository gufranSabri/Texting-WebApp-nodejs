var indices= {}, messages=[], roomCount=0;

function addUser(id,index){
    if(id==="")return;
    var user= document.createElement("DIV");
    user.className="user"
    user.addEventListener('click',selectContact);

    document.querySelector("#conts").appendChild(user)

    var u= document.createElement("SPAN");
    u.innerHTML = id.split('-').filter(function(uu){return uu!=you});

    user.id=u.innerHTML;
    messages.push({name:u.innerHTML,pending:0,chats:[]})
    indices[user.id]=index;
    roomCount++;
    
    user.appendChild(u);
}
function addBlockedUser(id,index){
    if(id==="")return;
    var user= document.createElement("DIV");
    user.className="user"
    user.addEventListener('click',unblock);
    document.querySelector("#bConts").appendChild(user)

    var u= document.createElement("SPAN");
    u.innerHTML = id;
    user.id=u.innerHTML;
    user.appendChild(u);
}
function unblock(){
    var ans = prompt("Are you sure you want to unblock this user?\nEnter Y to confirm.")
    if(ans=='y'||ans=="Y"){
        var f=document.getElementById($(this).attr("id")).childNodes[0].innerHTML;
        addUser(returnRoom(you,f),roomCount)
        socket.emit('joinRoom', {user:you,friend:f})
    }
}
function addMessage(user, text){
    var message= document.createElement("DIV");
    message.className="message";

    var span= document.createElement("SPAN")
    span.innerHTML= "<b>" + user + "</b>" + "<br><pre>"+text+"<pre>"

    message.appendChild(span);
    document.querySelector(".chat").appendChild(message)

    document.querySelector(".chat").scrollTo(0,document.querySelector(".chat").scrollHeight);
}
function handleEmission(friend, text, senderIsYou){
    messages[indices[friend]].chats.push({user:senderIsYou?"You":friend,text:text})
    if(!senderIsYou&&contact!=friend){
        var p=++messages[indices[friend]].pending;
        document.getElementById(friend).innerHTML= "<span>"+friend+"</span>"+ 
            (p==0?"":"  <span class='notifCount'>"+p+"</span>")
    }
    else {
        messages[indices[friend]].pending=0;
        addMessage(senderIsYou?"You":friend, text)
    }
}
function selectContact(){
    contact=document.getElementById($(this).attr("id")).childNodes[0].innerHTML;
    document.querySelector(".chat").innerHTML="";
    if($(document).width()<645)$(".hamburgerHolder").click()
    // document.querySelector(".cButtons").style.display="flex";
    document.getElementById("contName").innerHTML=contact;
    document.querySelector(".bottom").style.visibility="visible";
    document.getElementById("send").style.visibility="visible";
    document.getElementById("text").style.visibility="visible";
    messages[indices[contact]].chats.forEach(function(message, index){addMessage(message.user,message.text);})
    messages[indices[contact]].pending=0;
    document.getElementById(contact).innerHTML= "<span>"+contact+"</span>"
    socket.emit('read',{sender:contact,sentTo:you});
}
function sendRequest(){
    $("#prompt").html(" Loading...")
    if($("#name").val()=="")$("#prompt").html(" Wow you're dense...")
    else{
        var x=$("#name").val()
        $.post("/chat", {user:you, friend:$("#name").val()},
        function(data,status){
            if(data.res=="sent"){
                $("#prompt").html(" Friend added!")
                addUser(data.room,roomCount)
                socket.emit('joinRoom', {user:you,friend:x})
            }
            else if(data.res=="redundant")$("#prompt").html(" User is already your friend!")
            else if(data.res=="same")$("#prompt").html(" You lonely af to try to friend yourself damn!")
            else if(data.res=="ghost") $("#prompt").html(" User doesn't exist!"); 
            else if(data.res=="blocked")$("#prompt").html("You've been blocked...")
            else $("prompt").html("Sorry! Could not process your request..")
        })
    }
}
function loadMessages(){
    $.post("/loads", {user:you},
    function(data,status){
        for (let i = 0; i < data.length; i++) {
            var friend = data[i].room.replace(you,"").replace("-","");
            data[i].records.forEach(function(obj, index){
                messages[indices[friend]].chats.push({user:obj.Sender==you?"You":obj.Sender, text:obj.Text});
                if(obj.Readed=="N"&&obj.Sender!=you)messages[indices[friend]].pending++;
            })
            if(contact==friend)messages[indices[friend]].chats.forEach(function(message, index){addMessage(message.user,message.text);})
            else if(messages[indices[friend]].pending!=0)
                document.getElementById(friend).innerHTML= "<span>"+friend+"</span>"+ 
                    (messages[indices[friend]].pending==0?"":"  <span class='notifCount'>"+
                    messages[indices[friend]].pending+"</span>")
        }
    })
}
function returnRoom(u,f){
    var rA= [u,f]
    rA.sort();
    return rA.join("-")
}