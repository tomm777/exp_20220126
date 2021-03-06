var express = require('express');
var router = express.Router();

// 문자를 HASH하기(암호보안)
const crypto = require('crypto');

// 참고 : https://github.com/mongodb/node-mongodb-native
// CMD> npm i mongodb --save
const db     = require('mongodb').MongoClient;
const dburl  = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

// 토큰 발행을 위한 필요 정보 가져오기
// CMD> npm i jsonwebtoken --save
const jwt    = require('jsonwebtoken');
const jwtKey = require('../config/auth').securitykey;
const jwtOptions = require('../config/auth').options;
const checkToken = require('../config/auth').checkToken;

//조회 : await axios.get(url, {headers:headers});
//추가 : await axios.post(url, body, {headers:headers});
//수정 : await axios.put(url, body, {headers:headers});
//삭제 : await axios.delete(url, {headers:headers, data:{}});


// --SQLBOOST에서 시퀀스 생성
// db.sequence.insert({
//   _id : 'SEQ_MEMBERADDR1_NO',
//   seq : 2000,
// })

// 주소등록
// /member/insertaddr
// vue 에서는 토큰 입력할 주소
router.post('/insertaddr', checkToken, async function(req, res, next) {
  try {
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('sequence');
    const result = await collection.findOneAndUpdate(
      { _id : 'SEQ_MEMBERADDR1_NO' }, // 가지고 오기 위한 조건
      { $inc : {seq : 1 } }           // seq값을 1증가씨킴
    );

    const obj = {
      _id       : result.value.seq,  //시퀀스값
      address   : req.body.address, //주소정보
      memberid  : req.body.uid, // 토큰에서 꺼내기
      chk       : 0,  // 대표주소설정 (숫자크면 우선순위 부여)
      regdate   : new Date()
    }

    // 컬렉션명 memberaddr1
    const collection1 = dbconn.db(dbname).collection('memberaddr1');
    const result1     = await collection1.insertOne(obj);

    // 결과확인
    if(result1.insertedId === result.value.seq) {
      return res.send({status : 200});
    }
    return res.send({status : 0});
  }
  catch(e) {
    console.error(e);
    res.send({status : -1, message:e});
  }
});



// 주소목록
router.get('/selectaddr', checkToken,async function(req, res, next) {
  try {
    const email = req.body.uid; // 토큰에서 이메일 꺼내기
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('memberaddr1');

    const result = await collection.find(
      {memberid : email},
      {projection : { memberid : 0 }}
    ).sort({_id : 1}).toArray();

    // [{chk : 0 },{chk : 0},{chk : 0}] 3개면 이렇게 나옴
    // 체크 된 것이 없으면 result[0]를 1로 바꾼다
    // 대표주소
    let sum = 0;
    for(let i=0;i<result.length;i++){
      // sum = sum + Number(result[i].chk);
      sum += Number(result[i].chk);
    }
    if(sum <= 0){  // 체크 된것이 없으면
      result[0].chk = 1;
    }
    return res.send({status : 200, result:result});
    }

  catch(e) {
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 주소삭제
router.delete('/deleteaddr', checkToken,async function(req, res, next) {
  try{
  
  const email = req.body.uid; // 토큰에서 이메일 꺼내기
  const no = req.body.no;     // 삭제할 _id값

  // 1. db연결, db선택, 컬렉션선택
  const dbconn = await db.connect(dburl);
  const collection = dbconn.db(dbname).collection('memberaddr1');
    const result = await collection.deleteOne(
      { _id  : no, memberid : email }
    );
    
    if(result.deletedCount === 1){
      return res.send({status : 200});
    }
  // 로그인 실패시
  return res.send({status : 0});
}
catch(e) {
  console.error(e);
  res.send({status : -1, message:e});
}
});


// 대표주소수정
router.put('/updatechkaddr', checkToken,async function(req, res, next) {
  try {
    const email = req.body.uid; // 토큰에서 이메일 꺼내기
    const no = req.body.no;     // 삭제할 _id값

    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('memberaddr1');

    const result = await collection.updateMany(
      {memberid : email}, // memberid가 e메일과 일치
      {$set : {chk : 0}}
    );
    console.log(result);

    if(result.matchedCount > 0 ){


    // 1개만 chk 1 로 바꿈
    const result1 = await collection.updateOne(
      {_id: no, memberid : email}, // memberid가 e메일과 일치
      {$set : {chk : 1}}
    );

    if(result1.modifiedCount === 1){
      return res.send({status : 200})
    }
  }
  return res.send({status : 0})
    }

  catch(e) {
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 주소 수정
router.put('/updateaddr', checkToken, async function(req, res, next) {
  try{    
    const email = req.body.uid; // 토큰에서 이메일 꺼내기
    const no = req.body.no;     // 수정할 조건 _id값
    const address = req.body.address; // 수정할 내용

    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('memberaddr1');
    const result = await collection.updateOne(
      {memberid : email, _id : no}, 
      {$set : {address : address}}
    );
    if(result.modifiedCount === 1){
      return res.send({status : 200})
    }
    return res.send({status : 0})

    }
    
    catch(e){
        console.error(e);
        res.send({status : -1, message:e});
    }
    });
    

// 토큰이 오면 정보전송 전송함
// localhost:3000/member/validation
router.get('/validation', checkToken,async function(req, res, next) {
  try {
      return res.send({
        status : 200,
        uid  : req.body.uid,
        uname : req.body.uname,
        urole  : req.body.urole});
    }

  catch(e) {
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 로그인 post
// localhost:3000/member/select
// 이메일, 암호  => 현시점에 생성된 토큰을 전송
router.post('/select', async function(req, res, next) {
  try {
    // 1. 전송값 받기(이메일, 암호)
    const email = req.body.email;
    const pw    = req.body.password;

    // 2. 암호는 바로 비교 불가 회원가입과 동일한hash후에 비교
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // 3. 회원정보가 일치하면 토큰을 발행
    // 3. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');
    // 이메일과 hash한 암호가 둘다(AND) 일치
    const result     = await collection.findOne({
      _id : email, pw : hashPassword    
    });

    if(result !== null) { //로그인 가능
      const token = jwt.sign(
        { uid   : email,
          uname : result.name,
          urole : result.role 
        }, // 세션 => 토큰에 포함할 내용(아이디, 이름, 권한)
        jwtKey,           // 토큰생성시 키값
        jwtOptions,       // 토큰생성 옵션
      );
      return res.send({status : 200, token:token});
      // uid:email, uname:result.name, // 이메일, 이름
      // urole : result.urole //권한
    }

    return res.send({status : 0});
  }
  catch(e) {
    console.error(e);
    res.send({status : -1, message:e});
  }
});



// 회원가입 post
// localhost:3000/member/insert
// 이메일(PK), 암호, 이름, 등록일(자동생성)
router.post('/insert', async function(req, res, next) {
  try{
    // 사용자1 aaa  => feioufeiu4398feji8r3u9835r => 16진수로
    // 사용자2 aaa  => 7u56756764398feji8r3u9835r => 16진수로
    // aaa가 같아도 다른 해쉬로 받을수 있음
    const hashPassword = crypto.createHmac('sha256', req.body.email)
      .update(req.body.password).digest('hex');

    const obj = {
      _id     : req.body.email,
      pw      : hashPassword,
      name    : req.body.name,
      role    : req.body.role,
      regdate : new Date(),
    }

    // 2. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');
    const result     = await collection.insertOne(obj);

    // 결과확인
    if(result.insertedId === req.body.email) {
      return res.send({status : 200});
    }
    return res.send({status : 0});
  }
  catch(e){
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 이메일 중확확인 get
// 이메일 => 결과
// localhost:3000/member/emailcheck?email=a@a.com
router.get('/emailcheck', async function(req, res, next) {
  try{
    // 1. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');

    // 2. 일치하는 개수 리턴 0 또는 1
    const result     = await collection.countDocuments({
      _id : req.query.email
    });

    return res.send({status : 200, result : result});
  }
  catch(e){
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 회원 이름변경 put
// localhost:3000/member/update
// 이메일(PK), 이름(변경할 내용)
router.put('/update',checkToken, async function(req, res, next) {
  try{
    // 1. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');
    const result     = await collection.updateOne(
      {_id : req.body.uid}, // 조건
      { $set : {name : req.body.name}} // 실제 변경할 항목들
      );

      if(result.modifiedCount === 1){
        return res.send({status : 200});
    }
    return res.send({status : 0});
  }
  catch(e){
    console.error(e);
    res.send({status : -1, message:e});
  }
});



// 회원 암호변경 put
// localhost:3000/member/updatepw
// 토큰 이메일, 현재암호, 변경할 암호
router.put('/updatepw',checkToken, async function(req, res, next) {
  try{
    const email = req.body.uid;  // 토큰에서 꺼낸 정보
    const pw = req.body.password;  // 현재암호
    const pw1 = req.body.password1 // 변경할 암호

    // 1. 암호는 바로 비교 불가 회원가입과 동일한hash후에 비교
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // 2. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');

    // 로그인
    const result     = await collection.findOne({
        _id : email, pw : hashPassword    
      });
    
      if(result !== null){ // 로그인 가능
        const hashPassword1 = crypto.createHmac('sha256', email)
      .update(pw1).digest('hex');

      const result1 = await collection.updateOne(
        {_id : email},
        {$set : {pw: hashPassword1} }
        );

        if(result1.modifiedCount === 1){
          return res.send({status : 200});
    }
  }
  // 로그인 실패시
    return res.send({status : 0});
  }
  catch(e){
    console.error(e);
    res.send({status : -1, message:e});
  }
});

// 회원탈퇴 delete
// localhost:3000/member/delete
// 토큰 이메일, 현재암호
router.delete('/delete',checkToken, async function(req, res, next) {
  try{
    const email = req.body.uid;
    const pw = req.body.password;
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // 1. db연결, db선택, 컬렉션선택
    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('member1');
    const result = await collection.findOne({
      _id : email, pw : hashPassword    
    });
    if(result !== null) { //로그인 가능
      const result1 = await collection.deleteOne(
        { _id  : email }
      );
      
      if(result1.deletedCount === 1){
        return res.send({status : 200});
      }
    }
    // 로그인 실패시
    return res.send({status : 0});
  }
  catch(e){
    console.error(e);
    res.send({status : -1, message:e});
  }
});



module.exports = router;