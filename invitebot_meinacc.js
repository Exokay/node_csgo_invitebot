var Steam = require('steam');
var SteamGroups = require('steam-groups');
var SteamTotp = require('steam-totp');
var mysql = require('mysql');
var parseString = require('xml2js').parseString;
var request = require('request');
var csgo = require('csgo');
var fs = require('fs');
var util = require('util');
//MYSQL SETUP
var mysqlInfo;
mysqlInfo= {
	host	: 'localhost',
	user	: 'dbuser',	// replace
	password: 'xxxxxxx',
	database: 'invite',
	charset	: 'utf8_general_ci'
};
var mysqlConnection = mysql.createConnection(mysqlInfo);

// Utils used for Logging...
Date.prototype.yyyymmdd = function() {
   var yyyy = this.getFullYear().toString();
   var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   var dd  = this.getDate().toString();
   return yyyy + " " + (mm[1]?mm:"0"+mm[0]) + " " + (dd[1]?dd:"0"+dd[0]); // padding
};

logger = function(d) { //
	console.log(d);
	var date = new Date().yyyymmdd();
	fs.appendFile(__dirname + '/Logs/'+ date +'.log', "(" + new Date().getTime() + ") nForce56 " + util.format(d) + '\n', function (err) { /* ... */ });
};

//MYSQL SETUP ENDE
//STEAM SETUP
var steamClient = new Steam.SteamClient();
var steamUser = new Steam.SteamUser(steamClient);
var steamGroups = new SteamGroups(steamClient);
var steamFriends = new Steam.SteamFriends(steamClient); // NEW ADDED!
//Steam API KEY & Profile
var apikey='xxxxxxxxxxxxxxx'; // replace with steam api key
var botprofile='xxxxxxxxxxx'; // replace with steam profile id
var istate=0;
// Steam Game Coordinator
steamGC = new Steam.SteamGameCoordinator(steamClient, 730);
CSGOCli = new csgo.CSGOClient(steamUser, steamGC, false);


steamClient.connect();
steamClient.on('connected', function() {
	setInterval(function(){
		if(!steamClient.loggedOn) {
				steamUser.logOn({
					account_name: 'xxxxx', //STEAM ID
					password: 'xxxxxx',		// STEAM PW
                    two_factor_code: 'xxxxx' //STEAM 2F Code
                    //auth_code:'xxxxx'		// Use Auth Code if no 2F on Steam Acc
				});
			}
    },10*1000);
});
//Steam Setup Ende

//Steam Login Error abfangen
steamClient.on('error',function(error) {
	logger("Caught Steam error "+error+"");
});

//Steam Login SUCCESS FUNCTION START
steamClient.on('logOnResponse', function() { 
	steamFriends.setPersonaState(Steam.EPersonaState.Online);
	logger("Login Success");
	CSGOCli.launch();
	setInterval(Add,5000);		// SET TIME BETWEEN USER CHECKING FOR ADDING!
	setInterval(CheckFriends,10000); // SET TIME FOR Checking interval of Friendlist
	//setInterval(getnewUsers,300*1000);	// Interval Function to renew Database Steam IDS
	setInterval(CheckAdd,60*1000);
});

//Global SETUP
steamClient.on('webSessionID', function(sessionID) {
	globalSessionID = sessionID;
});

//DEBUG
steamClient.on('debug', console.log);

//FRIENDLIST CHECK SETUP
var SteamFriendlist = require('machinepack-steam');
//FRIENDLIST CHECK END

//STEAM USERINFO SETUP
var steamuserinfo = require('steam-userinfo');
steamuserinfo.setup(apikey);
//STEAM USERINFO SETUP ENDE

//FUNCTION LAST ONLINE CHECK		REWORKED! ONLY REPLYING 1337 on Online guys. Otherwise 0
function getOntime(steamid,callback) {
	steamuserinfo.getUserInfo(steamid, function(error, data){
		var output="0";
		if(error) {
			logger(error);callback(output);
		}else {
			var datadec = JSON.parse(JSON.stringify(data.response));
			if(datadec.players.length==0){
				callback(output);
			}else{
				if(datadec.players[0].personastate==1 || datadec.players[0].personastate==2 || datadec.players[0].personastate==3 || datadec.players[0].personastate==5) {
					callback("1337");
				}
				callback(output);
			}
		}
		
	});
}


//Invite Bot on Message
steamFriends.on('message', function(source, message, type, chatter) {
	
	if((source==="76561198013129088" || source==="76561198077424237")&& message=="/clearlist") {
		logger("Bot FL Getting cleared.");
        steamFriends.sendMessage(source, 'Cleare FL', Steam.EChatEntryType.ChatMsg);
		CheckAdd();
	}
    if((source==="76561198013129088" || source==="76561198077424237")&& message=="/newusers") {
        logger("NewIDS");
        steamFriends.sendMessage(source, 'Adde neue Leute', Steam.EChatEntryType.ChatMsg);
        getnewUsers();
    }
    if((source==="76561198013129088" || source==="76561198077424237")&& message=="/pause") {
        logger("NewIDS");
        steamFriends.sendMessage(source, 'Mache Pause lul', Steam.EChatEntryType.ChatMsg);
        istate=1;
    }
    if((source==="76561198013129088" || source==="76561198077424237")&& message=="/resume") {
        logger("NewIDS");
        steamFriends.sendMessage(source, 'Invite wieder lul', Steam.EChatEntryType.ChatMsg);
        istate=0;
    }
    if((source==="76561198013129088" || source==="76561198077424237")&& message.indexOf("/name")> -1) {
        let testkek2=message.split("/name ");
        testkek2[1] = testkek2[1].toString();
        steamFriends.setPersonaName(testkek2[1]);
    }

    if((source==="76561198013129088" || source==="76561198077424237")&& message.indexOf("/add")> -1) {
        let testkek=message.split(" ");
		testkek[1] = testkek[1].toString();
        steamFriends.addFriend(testkek[1]);
        steamFriends.sendMessage(source, 'Adde '+testkek[1], Steam.EChatEntryType.ChatMsg);
        logger("Added "+testkek[1]);
    }
});

steamFriends.on('friend', function(source, message) {

	if(message ==="4") {
	} else {
		mysqlConnection.query('Update addtime set state=1 where steamid='+source,function(err) {
			if(err) {
				logger(err);
			}
		});
	}
});
// ADDING ONLINE PPL!
function Add() {
    if(istate==0) {
        if(steamClient.loggedOn==false) {
            logger("DC!");
            return;
        }
        var lastinviteID=0;
        mysqlConnection.query('Select value from Info where Name="lastid"',function(err,row,fields) {
            if(err){
                console.log(err);
            } else {
                lastinviteID=row[0].value;
                lastinviteID=lastinviteID+1;
                mysqlConnection.query('Select * from invites where ID="'+lastinviteID+'"',function(err,row,fields) {
                    if(row.length>0){
                        var inviteid=row[0].steamIDtoinvite.toString();
                        getOntime(inviteid,function(output){

                            if(output==1337) {
                                steamFriends.addFriend(inviteid);
                                logger("added "+inviteid+"");
                                var timestamp2=Date.now();
                                timestamp2=timestamp2+43200000;
                                mysqlConnection.query("Insert into addtime values('0','"+inviteid+"','"+timestamp2+"','0','1')",function(err) {});
                            }

                        });

                        mysqlConnection.query('Update Info set value=value+1 where Name="lastid"',function(err) {
                            if(err) {
                                logger(err);
                            }
                        });
                    }
                });
            }
        });
	}
}

function CheckAdd() {
	var itime=Date.now();
	mysqlConnection.query('Select * from addtime where timestamp < "'+itime+'" and state="0" and bot_id="1"',function(err,row) {
		if(row.length==0) return;
		var steamid=row[0].steamid;
		steamFriends.removeFriend(steamid);
		logger('removing '+steamid+': not reacting to invite.');
		mysqlConnection.query('Delete from addtime where steamid="'+steamid+'"',function(err) {});
	});
}

//CHECKING FRIENDLIST
function CheckFriends() {
            SteamFriendlist.getFriendList({
                steamid: botprofile,
                key: apikey,
            }).exec({
                // An unexpected error occurred.
                error: function (err){
                    logger(err);
                    return;
                },
                // OK.
                success: function (result){
                    var datadec2 = JSON.parse(JSON.stringify(result.friendslist.friends));
					for(let iCounter = 0; iCounter < datadec2.length; iCounter++) {
						let curr_id = datadec2[iCounter].steamid.toString();
						if(curr_id === "76561198013129088" || curr_id=== "76561198077424237" || curr_id==="76561198141659039" || curr_id==="76561197974270237") {
							// Skipping ids here

						} else {
                            steamFriends.sendMessage(curr_id, "Hi, I'am a bot of http://steamcommunity.com/id/Exoyo88 .", Steam.EChatEntryType.ChatMsg);
                            steamFriends.sendMessage(curr_id, "I've accepted a bet, where i had to have a steamgroup with 1000 members till 1.6.18. This is the grouplink.  http://steamcommunity.com/groups/mysecondlife",Steam.EChatEntryType.ChatMsg);
                            steamFriends.sendMessage(curr_id, "It's just a regular Steam Group but we try to get a Server sponsored to provide it for the Community. BTW: We're doing Giveaways sometimes", Steam.EChatEntryType.ChatMsg);
                            steamGroups.inviteUserToGroup('103582791440889275',""+curr_id);		//Change Steam Group ID to your group!
                            logger("invited "+curr_id+"");
                            steamFriends.removeFriend(curr_id);
                            iCounter = datadec2.length; // cancel for loop
						}
					}
                }
            });

}

function getnewUsers(){
	
	mysqlConnection.query('Select value from Info where Name="lastlink"',function(err,row,fields) {
			
		var lastID=row[0].value;
		lastID=lastID+1;

		mysqlConnection.query('Select * from nextlink where ID="'+lastID+'"',function(err,row,fields) {
			if(row.length>0){
				mysqlConnection.query('Update Info set value="'+lastID+'" where name="lastlink"',function(err,row,fields) {});
				var headers = {	//Headers to allow steam access
					'User-Agent':       'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
					'Content-Type':     'application/x-www-form-urlencoded'
				};
		
				var options = {
					url: row[0].nextlink,
					headers: headers,
					json:true
				};

				request(options, function(error, response, body){
					if(!error && response.statusCode === 200){
						parseString(body, function (err, result) {
							var datadec =JSON.parse(JSON.stringify(result.memberList.nextPageLink));
							if(datadec===undefined || datadec=="") {
								logger("error getting the next group link");
							} else {
								datadec=datadec.toString().replace("'","");
								datadec=datadec.toString().replace("[","");
								datadec=datadec.toString().replace("]","");
								logger(datadec);
								mysqlConnection.query("Insert into nextlink values ('0','"+datadec+"')",function(err,row,fields) {});
							}
							
							// get the Members & Filtering Members
							var members=JSON.stringify(result.memberList.members).split(",");
							for (count = members.length - 1; count >= 1; --count) {
								var thismember=members[count];
								
								if(!(thismember.indexOf('{"steamID64":[')<=-1) || thismember===undefined){
								} else {
									thismember=thismember.replace('"',"");
									thismember=thismember.replace('"',"");
									thismember=thismember.replace(']}]',"");
									mysqlConnection.query("Insert into invites values ('"+thismember+"','0')",function(err,row,fields) {});
									
								}
							}
							logger("Adding ppl done!");
						});
					}
				});
			}
		});
	});
}
