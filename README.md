# YNAB MQTT Log

Publishes significant [YNAB](https://www.youneedabudget.com) changes to a MQTT broker.

## Configuration

Configured with environment variables.

 - **`YNAB_TOKEN`**: [API token for YNAB](https://app.youneedabudget.com/settings/developer)
 - **`BUDGET_ID`**: identifier for the budget to follow (visible in the address bar when in YNAB)
 - **`MQTT`**: [url to MQTT broker](https://www.npmjs.com/package/mqtt#connect)
 - **`POLL_SECONDS`**: how often to check YNAB for changes. Defaults to 20 seconds.
