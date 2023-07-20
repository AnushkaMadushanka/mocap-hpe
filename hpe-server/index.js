const express = require('express')
const cors = require('cors');
require('dotenv').config()
const app = express()
app.use(express.json())
app.use(cors({
    origin: process.env.FRONTEND_URL
}));
const port = process.env.PORT || 3001

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.use('/api/animations', require('./routes/animation.route'))
app.use('/api/user', require('./routes/user.route'))
app.use('/api/auth', require('./routes/auth.route'))

app.listen(port, () => {
  console.log(`HPE Server listening on port ${port}`)
})