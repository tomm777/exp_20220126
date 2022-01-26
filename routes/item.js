var express = require('express');
var router = express.Router();

//CMD > npm i mongodb --save
const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

//CMD > npm i multer --save
const multer = require('multer');
const upload = multer({storage:multer.memoryStorage()});

router.get('/insert', function(req, res, next) {
  res.send('respond with a resource');
});


// 컬렉션에 item1에 항목을 추가하는 것
// localhost:3000/item/insert 
// 전송되는 값 : name, content, price, quantity, image
// 자동으로 생성 : _id , regdate
router.post('/insert', upload.single("image"),
        async function(req, res, next) {
  try{
     //1. DB접속 
     const dbconn = await db.connect(dburl);
     //2. DB선택 및 컬렉션 선택
     const collection = dbconn.db(dbname).collection('sequence');
     //3시퀀스에서 값을 가져오고, 그 다음 위해서 증가
     const result = await collection.findOneAndUpdate(
         // 데이터베이스를 참고하여 작성해야함
         {_id : 'SEQ_ITEM1_NO'}, // 가지고 오기 위한 조건
         {$inc : {seq : 1}}       // seq값을 1증가시킴 
         ); 
      console.log('-----------------------');
      // 4. 정상동작 유무를 위한 결과 확인
      console.log(result.value.seq);
      console.log('-----------------------');
    const obj = {
      _id      : result.value.seq,
      name     : req.body.name,
      content  : req.body.content,
      pirce    : Number(req.body.price),
      quantity : Number(req.body.quantity),
      filename : req.file.originalname,
      filedata : req.file.buffer,
      filetype : req.file.mimetype,
      filesize : req.file.size,
      regdate  : new Date()
    };
    console.log(req.file.size);

      // 추가할 컬렉션 선택
      const collection1 = dbconn.db(dbname).collection('item1');
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
