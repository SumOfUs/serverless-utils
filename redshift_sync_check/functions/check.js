'use strict';

// To be run every hour.
// For checking important tables on Redshift for records
// newer than five hours. If none are found then a warning
// message is posted to #dev_team on slack.
//
// See serverless.yml for event configuration.
//
// To deploy:
//
// sls invoke local \
//   -f check \
//   --slack-webhook WEBHOOK_URI \
//   --pg-host HOST \
//   --pg-username USERNAME \
//   --pg-db DB NAME \
//   --pg-password PASSWORD
//

// Five hours in milliseconds
const FIVE_HOURS = 60 * 60 * 1000 * 5;

// Redshift client
const { Pool, Client } = require('pg');

// Slack client
const Slack = require('slack-node');
const slack = new Slack();

slack.setWebhook(process.env.SLACK_WEBHOOK);

// Tables to check. Must have a `created_at` row.
const tables = [
  'mailing',
  'user',
  'action',
  'open',
  'usermailing',
  'click'
];

const notify = (table) => {
  let message = `<@here>, there might be a problem with the Redshift sync: \n
*${table}* appears to have not been updated for over 5 hours. \n
Please see https://github.com/SumOfUs/redshift_management/wiki for instructions on what to do next.\n
Have a banana!`;

  slack.webhook({
    channel: "#dev_team",
    username: "redshift_bot",
    text: message,
    icon_emoji: ':monkey_face:'
  }, (err, response) => {
    if(err){
      console.log(`Slack webhook error: ${JSON.stringify(response)}`);
    }
  });
};

const fiveHoursAgo = () => {
  return new Date( (new Date()) - FIVE_HOURS  ).
    toISOString().
    substring(0, 19).
    replace('T', ' ');
};

const checker = (tableName, _) => {
  let pool = new Pool();

  let query = `SELECT MAX(created_at)
               FROM ak_sumofus.core_${tableName}
               WHERE created_at > '${fiveHoursAgo()}';`

  pool.query(query, (err, res) => {
    if(!err) {
      console.log(`Result for core_${tableName}: ${res.rows[0].max}`);

      if( !res.rows[0].max ) {
        console.log(`whooops: core_${tableName} is out of sync`);
        notify(`core_${tableName}`);
      }
    } else {
      console.log(`Error: ${err}`);
    }
  });
};

module.exports.handler = (event, context, callback) => {
  tables.forEach(checker);
  callback(null, {message: 'execution done'});
};
