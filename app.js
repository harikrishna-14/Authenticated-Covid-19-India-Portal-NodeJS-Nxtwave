const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const initialzeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }
}

initialzeDBAndServer()

app.post('/login/', async (req, res) => {
  const userDetails = req.body
  const {username, password} = userDetails
  const hashedPassword = bcrypt.hash(password, 10)
  const getUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const userData = await db.get(getUserQuery)
  if (userData === undefined) {
    res.status(400)
    res.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, userData.password)
    if (!isPasswordMatched) {
      res.status(400)
      res.send('Invalid password')
    } else {
      const payload = {
        username,
      }
      const jwtToken = jwt.sign(payload, 'My_Secret_Token')
      res.send({jwtToken})
    }
  }
})

const authenticateToken = (req, res, next) => {
  let jwtToken
  const authHeader = req.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    res.status(401)
    res.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'My_Secret_Token', async (error, payload) => {
      if (error) {
        res.status(401)
        res.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

const convertStatesToCamelCase = obj => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

const convertDistToCamelCase = obj => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  }
}

app.get('/states/', authenticateToken, async (req, res) => {
  const getStatesQuery = `SELECT * FROM state`
  const statesArray = await db.all(getStatesQuery)
  res.send(statesArray.map(eachState => convertStatesToCamelCase(eachState)))
})

app.get('/states/:stateId', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const getStateQuery = `SELECT * FROM state WHERE state_id=${stateId}`
  const stateDetails = await db.get(getStateQuery)
  res.send(convertStatesToCamelCase(stateDetails))
})

app.post('/districts/', authenticateToken, async (req, res) => {
  const districtDetails = req.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  const addDistrictQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths) VALUES('${districtName}', ${stateId}, '${cases}', '${cured}', '${active}', '${deaths}')`
  await db.run(addDistrictQuery)
  res.send('District Successfully Added')
})

app.get('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const getDistQuery = `SELECT * FROM district WHERE district_id=${districtId}`
  const distData = await db.get(getDistQuery)
  res.send(convertDistToCamelCase(distData))
})

app.delete('/districts/:districtId/', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const deleteDistrictQuery = `DELETE FROM district WHERE district_id=${districtId}`
  await db.run(deleteDistrictQuery)
  res.send('District Removed')
})

app.put('/districts/:districtId', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const district = req.body
  const {districtName, stateId, cases, cured, active, deaths} = district
  const updateDistrictQuery = `UPDATE district SET district_name='${districtName}', state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths} WHERE district_id=${districtId}`
  await db.run(updateDistrictQuery)
  res.send('District Details Updated')
})

app.get('/states/:stateId/stats/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  const statsQuery = `SELECT sum(cases) as totalCases, sum(cured) as totalCured, sum(active) as totalActive, sum(deaths) as totalDeaths FROM district WHERE state_id=${stateId} GROUP BY state_id`
  const stats = await db.get(statsQuery)
  res.send(stats)
})

module.exports = app
