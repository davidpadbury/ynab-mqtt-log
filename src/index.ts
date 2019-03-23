const got = require('got')
const mqtt = require('mqtt')

const TOKEN: string = env('YNAB_TOKEN')
const POLL_SECONDS: number = parseInt(process.env['POLL_SECONDS'] || '20', 10)
const BUDGET_ID: string = env('BUDGET_ID')
const MQTT: string = env('MQTT')

type YnabResult = [string, any]

const ynabClient = got.extend({
  baseUrl: 'https://api.youneedabudget.com/v1',
  json: true,
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
})

const mqttClient = mqtt.connect(MQTT)

function createYnabResult(response: any): YnabResult {
  const data = response.body.data
  return [data.server_knowledge, data]
}

async function fetchInitial(): Promise<YnabResult> {
  const path = `/budgets/${BUDGET_ID}/categories`
  return createYnabResult(await ynabClient(path))
}

async function fetchDelta(lastKnowledge: string): Promise<YnabResult> {
  const path = `/budgets/${BUDGET_ID}/categories?last_knowledge_of_server=${lastKnowledge}`
  return createYnabResult(await ynabClient(path))
}

async function sleep(duration): Promise<void> {
  return new Promise((resolve, reject) => setTimeout(resolve, duration))
}

function processDelta(delta: any, data: any) {
  for (const group of delta.data.category_groups) {
    console.log(group.name)
  }
}

interface MatchedItem {
  readonly current: any
  readonly next: any
}

function matchItems(oldItems: Array<any>, deltaItems: Array<any>): Array<MatchedItem> {
  return oldItems
    .map(old => {
      const delta = deltaItems.find(d => old.id === d.id)

      return delta ? { current: old, next: delta } : null
    })
    .filter(item => !!item)
}

interface Change {
  readonly category: string
  readonly field: string
  readonly old: any
  readonly current: any
}

function generateChanges(current: any, next: any): Array<Change> {
  return [ 'budgeted', 'activity', 'balance' ]
    .map(prop => {
      const currentValue = current[prop]
      const nextValue = next[prop]
      const changed = currentValue != nextValue

      if (!changed) return null

      // update the category
      current[prop] = nextValue

      return {
        category: current.name,
        field: prop,
        old: currentValue,
        current: nextValue
      }
    })
    .filter(item => !!item)
}

function publishChange(change: Change): Promise<void> {
  return new Promise((resolve, reject) => {
    mqttClient.publish('ynab/changes', JSON.stringify(change, null, 2), {}, (err) => err ? reject(err) : resolve())
  })
}

async function main(): Promise<void> {
  let [lastKnowledge, state] = await fetchInitial()

  while (true) {
    await sleep(POLL_SECONDS * 1000)
    const [newKnowledge, delta] = await fetchDelta(lastKnowledge)
    const groups = matchItems(state.category_groups, delta.category_groups)

    for (const group of groups) {
      const categoryChanges = matchItems(group.current.categories, group.next.categories)

      for (const { current, next } of categoryChanges) {
        const changes = generateChanges(current, next)

        if (changes.length > 1) {
          console.log(changes)
        }

        await Promise.all(changes.map(publishChange))
      }
    }

    lastKnowledge = newKnowledge
  }
}

main()
  .then(() => {}, err => {
    console.error(err)
    process.exit(1)
  })

function env(key: string): string {
  const value = process.env[key]

  if (!value) {
    console.error(`Environment variable "${key}" is not set`)
    process.exit(1)
  }

  return value
}
