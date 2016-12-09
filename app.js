var fs = require('fs');
var _ = require('lodash');
var moment = require('moment');
var config = require('config');
var TelegramBot = require('node-telegram-bot-api');

var dataStoreFile = config.get('dataStoreFile');
var timeFormat = config.get('timeFormat');
var dateTimeFormat = config.get('dateTimeFormat')
var token = config.get('telegramBotToken');

//Create Datastore
var data = loadData();
// Create a bot that uses 'polling' to fetch new updates
var bot = new TelegramBot(token, { polling: true });

// Matches "/start_activity [whatever]"
bot.onText(/\/start_activity (.+)/, function (msg, match) {
  var chatId = msg.chat.id;
  var activityName = match[1];

  var doc = _.find(data, function(o) { return o.chatId === chatId && !o.endDateTime });
  if(doc) {
    bot.sendMessage(chatId, "Only one concurrent activity is possible, finish [" + activityName + "] first!");
    return;
  }
  doc = {
    chatId: msg.chat.id,
    username: msg.chat.username,
    displayname: msg.from.first_name,
    activityName: activityName,
    startDateTime: moment().format(dateTimeFormat)
  };
  data.push(doc);
  bot.sendMessage(chatId, "Activity [" + activityName + "] started at " + moment(doc.startDateTime, dateTimeFormat).format(timeFormat));
});

// Matches "/stop_activity"
bot.onText(/\/stop_activity/, function (msg, match) {
  var chatId = msg.chat.id;

  var doc = _.find(data, function(o) { return o.chatId === chatId && !o.endDateTime });
  if(!doc) {
    bot.sendMessage(chatId, "No active activity found, use /start_activity");
  }
  doc.endDateTime = moment().format(dateTimeFormat); 

  var response = acticityToString(doc);
  bot.sendMessage(chatId, response);
  persistData();
});

// Matches "/list_my_activities"
bot.onText(/\/list_my_activities/, function (msg, match) {
  var myActivities = _.filter(data, function(o) { return o.username === msg.chat.username });
  _.forEach(myActivities, function(o) {
    bot.sendMessage(o.chatId, acticityToString(o));
  });
});

function acticityToString(doc) {
  var start = moment(doc.startDateTime, dateTimeFormat);
  var end = moment(doc.endDateTime, dateTimeFormat);

  var duration = moment.duration(end.diff(start));
  var durationHR = duration.humanize();

  var message = "Activity [" + doc.activityName + "] lasted " + durationHR;
  message += "\n" + "Milliseconds: " + duration.asMilliseconds();
  message += "\n" + "Seconds: " + duration.asSeconds();
  message += "\n" + "Minutes: " + duration.asMinutes();
  message += "\n" + "Hours: " + duration.asHours();
  message += "\n" + "Start: " + doc.startDateTime;
  message += "\n" + "End: " + doc.endDateTime;
  return message;
}

function loadData() {
  if (!fs.existsSync(dataStoreFile)) {
    return [];
  }
  var jsonStr = fs.readFileSync(dataStoreFile).toString();
  if(jsonStr) {
    return JSON.parse(jsonStr);
  }
  return [];
}

function persistData() {
  var options = { flag : 'w' };
  fs.writeFile(dataStoreFile, JSON.stringify(data), options, function(err) {
    if (err) throw err;
  });
}