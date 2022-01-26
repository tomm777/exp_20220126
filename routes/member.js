var express = require('express');
var router = express.Router();

//CMD > npm i mongodb --save
const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

//CMD > npm i multer --save
// const multer = require('multer');
// const upload = multer({storage:multer.memoryStorage()});

//회원가입, 로그인 암호 hash용
// const crypto = require('crypto')

// localhost:3000/member/insert
router.post('/insert', async function(req, res, next) {
  try{
     //1. DB접속 
     const dbconn = await db.connect(dburl);
     //2. DB선택 및 컬렉션 선택
     const collection = dbconn.db(dbname).collection('sequence');
     //3시퀀스에서 값을 가져오고, 그 다음 위해서 증가
     const result = await collection.findOneAndUpdate(
         // 데이터베이스를 참고하여 작성해야함
         {_id : 'SEQ_MEMBER1_NO'}, // 가지고 오기 위한 조건
         {$inc : {seq : 1}}       // seq값을 1증가시킴 
         ); 
      console.log('-----------------------');
      // 4. 정상동작 유무를 위한 결과 확인
      console.log(result.value.seq);
      console.log(req.body);
      console.log('-----------------------');
      // const hash = crypto.createHmac('sha256', req.body.uid)
      //           .update(req.body.upw).digest('hex');
    const obj = {
      _id : result.value.seq,
      email   : req.body.email,
      pw      : req.body.password,
      name    : req.body.name,
      regdate : new Date()
    };
    const collection1 = dbconn.db(dbname).collection('member1');
    //추가하기
    const result1    = await collection1.insertOne(obj);
    if(result1.insertedId == result.value.seq) {
      return res.send({status : 200});
  }
  return res.send({status : 0});



}
catch(e){
  console.error(e);
  res.send({status : -1, message:e});
}
});

module.exports = router;
