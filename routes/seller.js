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


// 이미지
//CMD > npm i multer --save
const multer = require('multer');
const { response } = require('express');
const upload = multer({storage:multer.memoryStorage()});

// 시간대별 주문수량
// localhost:3000/shop/grouphour
// 판매자의 토큰이 전송되면 검증후에 이메일을 꺼냄
// ITEM1 컬렉션에 판매자의 상품코드를 꺼냄
// order1에 상품코드가 일치하는 것만 가져와서 group처리

router.get('/grouphour', checkToken, async function(req, res, next) {
    try{  
        // 판매자 토큰
        const email = req.body.uid;
        const dbconn = await db.connect(dburl);
        // 이메일이 일치하는 판매자의 물품코드 [1,2,3,4,]
        const collection = dbconn.db(dbname).collection('item1');
        // 고유값 꺼내기 distinct(고유한 값 컬럼명, 조건)
        const result = await collection.distinct("_id",
                {seller : email});
        // [100,200]
        const collection1 = dbconn.db(dbname).collection('order1');

        const result1 = await collection1.aggregate([
            {
                $match : {
                    itemcode : {$in: result}
                }
            },
            {
            $project : {    // 가져올 항목 ( 물품코드, 주문수량)
                orderdate : 1,  // 주문일자
                ordercnt  : 1,  // 주문수량
                month : {$month : '$orderdate'},    // 주문일자를 이용해서 달
                hour  : {$hour  : '$orderdate'},    // 주문일자를 이용해서 시
                minute : {$minute  : '$orderdate'}, // 주문일자를 이용해서 분

            }
        },
        {
            $group : {
                _id : '$hour', // 그룹할 항목
                count : { $sum : '$ordercnt'}
            },
            },
            {
                $sort : {
                    _id : 1 
                }
            }
            

     ]).toArray();

    return res.send({status : 200,result:result1});
        
  
    }
        catch(e){
            console.error(e);
            res.send({status : -1, message:e});
        }
        });


// 회원목록  : 판매자가 등록한 물품에 대해 주문한 고객 정보
// localhost:3000/seller/memberlist
router.get('/memberlist',checkToken, async function(req, res, next){
    try {
        const email = req.body.uid  //판매자의 이메일
        const dbconn = await db.connect(dburl);

        const collection = dbconn.db(dbname).collection('item1');
        const result = await collection.find(
            {seller : email },          // 조건
            { projection : { _id : 1}}   // 가져올 컬럼 설정
            ).toArray();
            console.log(result);


        let code = [];
        for(let tmp of result){
            code.push(tmp._id);
        }
        const collection1 = dbconn.db(dbname).collection('order1');
        // 고유값 꺼내기 distinct(고유한값 컬럼명, 조건)
        const result1 = await collection1.distinct("orderid", 
        {itemcode  : {$in: code }});
            // console.log(result1);

            const collection2 = dbconn.db(dbname).collection('member1');
            const result2 = await collection2.find(
            {_id : {$in : result1} },          // 조건
            {projection : {pw : 0}}
            ).toArray();

            return res.send({status:200, result:result2});

         }
         catch(e) {
             console.error(e);
             return res.send({status : -1, message:e});
         }
     });

// 주문목록 : 판매자가 등록한 물품에 대해서 고객이 주문한 내역
// localhost:3000/seller/orderlist
// item1 + order1 + member1
router.get('/orderlist',checkToken, async function(req, res, next){
    try {
        const email = req.body.uid  //판매자의 이메일
        const dbconn = await db.connect(dburl);

        // 1. 판매자가 등록한 물품의 코드들 가져오기
        const collection = dbconn.db(dbname).collection('item1');
        const result = await collection.find(
            {seller : email },          // 조건
            { projection : { _id : 1}}   // 가져올 컬럼 설정
            ).toArray();
            console.log(result);


            // result => [{_id:1},{_id:2},{_id:3}]
            // [{}] -> []로 바꿔야함
            // $in = [] => [1,2,3,4]

        // 2 받은 결과를 배열로 변경
        //  [{_id:1},{_id:2},{_id:3},{_id:4}]
        let code = [];
        for(let tmp of result){
            code.push(tmp._id);
        }
        // 위에랑 똑같음
        // for(let i=0; i<result.length;i++){
        //     code.push(result[i]._id)
        // }

        // 3. 주문내역에서 가져온 코드에 해당하는 항목만 가져오기
        const collection1 = dbconn.db(dbname).collection('order1');
        const result1 = await collection1.find(
            {itemcode : {$in : code} },          // 조건
            ).toArray();

            // 4. result1에 있는 내용을 리턴함
            return res.send({status:200, result:result1});

         }
         catch(e) {
             console.error(e);
             return res.send({status : -1, message:e});
         }
     });

// 1. 물품1개 조회(물품코드가 전달되면)
// localhost:3000/seller/selectone?code=111
router.get('/selectone',checkToken, async function(req, res, next){
    try {
        // 키가 uid 인 이유는 로그인시에 토큰생성시 사용했던 키 정보 이름 = uname
        const email = req.body.uid;
        const code = Number(req.query.code);
        console.log(code);

        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        const result = await collection.findOne(
            {_id : code, seller : email}, // 조건 _id가 code와 일치하는 것
            {projection : {filename : 0, filedata : 0, filesize : 0 , filetype : 0}}, // 필요한 컬럼만
            );
            console.log(result);

             // 이미지 데이터를 전달 x 이미지를 볼 수있는 URL정보를 전달
             // 변수에 없는 키를 넣어야 추가가 됨. 있는키는 변경된다
             result.imageUrl = `/seller/image?code=${code}`;
        //   result['imageUrl'] = `/seller/image?code=${code}`;
             
        // 물품1개를 조회할때 서브 이미지의 정보를 전송하는 부분
        const collection1 = dbconn.db(dbname).collection('itemimg1');
        const result1 = await collection1.find(
            {itemcode : code}, // 조건
            {projection : {_id : 1}}
        ).sort({_id:1}).toArray();

        // 수동으로 서버이미지 PK정보를 저장함.
        // result1 => [{"_id":10006},{"_id":10007},{"_id":10008}]
        let arr1 = [];
        for(let i =0; i<result1.length;i++){
            arr1.push({
                subimageUrl : `seller/image1?code=${result1[i]._id}`
            });
        }
        result['subImage'] = arr1;
        
             console.log(result);
             return res.send({status : 200, result:result});
         }
         catch(e) {
             console.error(e);
             return res.send({status : -1, message:e});
         }
     });


// 2. 물품전체 조회(판매자 토큰에 해당하는 것만)
// localhost:3000/seller/selectlist
router.get('/selectlist',checkToken, async function(req, res, next){
    try {
        const email = req.body.uid;
        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        const result = await collection.find(
            {seller : email}, // 조건
            {projection : {filename : 0, filedata : 0, filesize : 0 , filetype : 0}}, // 필요한 컬럼만
            ).sort({_id : 1}).toArray();
            // sort => 나열방식
            // id : 1 => 오름차순
            

        // result => [ {result[0]}, {result[1]}, {result[2]} ]
        // 변수에 없는키를 넣어야 추가가 됨. 있는 키는 변경   
            for(let i=0; i<result.length; i++){
                                                                            
                result[i]['imageUrl'] = `/seller/image?code=${result[i]._id}&ts${new Date().getTime()}`;
                // 이미지를 바로 읽을수 있게 함
                //url정보를 다르게
            }

        return res.send({status:200, result:result});
      }
      catch(e){
              console.error(e);
              res.send({status : -1, message:e});
      }
  });

// 3. 물품 이미지 표시(물품코드가 전달되면 이미지 표시)
// 대표 이미지를 가져옴 item1 컬렉션에서 가져옴(코드로 가져옴)
// localhost:3000/seller/image?code=111
router.get('/image', async function(req, res, next){
    try {
        const code = Number(req.query.code);
        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        const result = await collection.findOne(
            {_id : code}, // 조건
            {projection : {filename : 1, filedata : 1, filesize : 1 , filetype : 1}}, // 필요한 컬럼만
            );

            res.contentType(result.filetype);
            return res.send(result.filedata.buffer);            


      }
      catch(e){
              console.error(e);
              res.send({status : -1, message:e});
      }
  });

// 3. 서브이미지 표시(물품코드가 전달되면 이미지 표시)
// 서브 이미지를 가져옴 itemimage1 컬렉션에서 가져옴(코드로 가져옴)
// localhost:3000/seller/image1?code=111
router.get('/image1', async function(req, res, next){
    try {
        const code = Number(req.query.code);
        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('itemimg1');

        const result = await collection.findOne(
            {_id : code}, // 조건
            {projection : {filename : 1, filedata : 1, filesize : 1 , filetype : 1}}, // 필요한 컬럼만
            );

            res.contentType(result.filetype);
            return res.send(result.filedata.buffer);            


      }
      catch(e){
              console.error(e);
              res.send({status : -1, message:e});
      }
  });

// 모르겠으면 console.log(req)를 찍어본다
// 조회 get으로 보내면 req.query로 와야함 query => 주소창에 url정보가 포함
// 추가 post로 보낼려면 req.body로 와야한다 body => 주소창에 Url정보가 없다
// 변경 put =>
// 삭제 delete =>
// 4. 물품번호 n개에 해당하는 항목 조회(물품코드 배열로 전달)
// localhost:3000/seller/selectcode?c=1038&c=1039
// {code :[1038,1039]}
router.get('/selectcode', async function(req, res, next){
    try {
        // 길어지는걸 방지해서 code=c로 변경
        // query로 전달되는 값을 변수로 저장(타입이 문자임)
        let code = req.query.c;

        // 반복문을 통해서 문자를 숫자로 변경(n개)
        for(let i=0; i<code.length; i++){
            code[i] = Number(code[i]);
        }
        console.log(code);

        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');
        // 조회하면 나오는 키정도 확인
        const result = await collection.find(
            {_id : {$in : code}}, // 조건
            {projection : {filename : 1, filesize : 1 , filetype : 1}}, // 필요한 컬럼만
            ).sort({_id : 1}).toArray();

            for(let i=0; i<result.length; i++){
                result[i]['imageUrl'] = `/seller/image?code=${result[i]._id}`;
            }

        return res.send({status:200, result:result});
      }
      catch(e){
              console.error(e);
              res.send({status : -1, message:e});
      }
  });
// {code : [1012, 1013]}





// 물품 일괄 수정
// localhost:3000/seller/update
router.put('/update',checkToken,upload.array("image"), async function(req, res, next){
    try {
        //2개이상 {code : [1011,1012], title : ['a','b']}
        //1개 {code :1011, title:'a'}
        console.log(req.body);

        //1개 [{}]
        //2개 [{},{}]
        console.log(req.files);
        // DB연동
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');
        console.log(req.body.title.length);

        // 여러개일 경우 req.body => {  code : [1011,1012], title : ['a','b']}
        // 한개일 경우 req.body => {title :1, price:3} 배열이 아님
        // req.files => [{},{}]

        // req.body.title이 배열인지 아닌지 물어보는 구문 2개 이상인가 아닌가
        if( Array.isArray(req.body.title) ) {
            let cnt = 0; //실제적으로 변경한 개수를 누적할 변수
            for(let i=0; i<req.body.title.length; i++){
                let obj = { //4개의 키만
                    name        : req.body.title[i],
                    price       : Number(req.body.price[i]),
                    quantity    : Number(req.body.quantity[i]),
                    content     : req.body.content[i],
                };

                // 이미지 첨부하면 키를 4개더 추가 8개
                if ( typeof req.files[i] !== 'undefined') {
                    obj['filename'] = req.files[i].originalname;
                    obj['filedata'] = req.files[i].buffer;
                    obj['filetype'] = req.files[i].mimetype;
                    obj['filesize'] = Number(req.files[i].size);
                }

                const result = await collection.updateOne(
                    { _id  : Number(req.body.code[i]) }, //조건
                    { $set : obj } //변경내용
                );
                cnt += result.matchedCount;
            }

            //실제 변경된 개수 === 처음 변경하기 위해 반복했던 개수 일치유무
            if(cnt === req.body.title.length){
                return res.send({status : 200});
            }
        }
        else {
            let obj = { //4개의 키만
                name        : req.body.title,
                price       : Number(req.body.price[i]),
                quantity    : Number(req.body.quantity[i]),
                content     : req.body.content,
            };

            // 이미지 첨부하면 키를 4개더 추가 8개
            if ( typeof req.files[0] !== 'undefined') {
                obj['filename'] = req.files[0].originalname;
                obj['filedata'] = req.files[0].buffer;
                obj['filetype'] = req.files[0].mimetype;
                obj['filesize'] = Number(req.files[0].size);
            }

            const result = await collection.updateOne(
                { _id  : Number(req.body.code) }, //조건
                { $set : obj } //변경내용
            );

            if(result.modifiedCount === 1){
                return res.send({status : 200});
            }
        }
       
        return res.send({status : 0});
    }
    catch(e) {
        console.error(e);
        return res.send({status : -1, message:e});
    }
});


// 물품 일괄 삭제
// localhost:3000/seller/delete
router.delete('/delete',checkToken, async function(req, res, next){
    try {
        // {"code":[1021,1022]}
        const code = req.body.code;
        console.log(code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

       // { $in : [1,2,3,4] } 포함 된 항목
       const result = await collection.deleteMany(
        { _id : {$in : code} }
    )
    console.log(result);
    if(result.deletedCount === code.length){
        return res.send({status : 200});    
    }
    return res.send({status : 0});
}
catch(e) {
    console.error(e);
    return res.send({status : -1, message:e});
}
});






// 물품 등록 : 로그인, 이미지를 포함하여 n개
// localhost:3000/seller/insert
// 로그인을 한 사용자가 판매자
router.post('/insert',upload.array("image"),checkToken, async function(req, res, next) {
    try {
        // 전송1, body   => {  title:[1,2], price:[3,4] }
        // 전송2, files  => [  {orginalname...  }, {  } ]
        // 최종,  arr    => [  {title , ... orginalname  }, {  } ]

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');
        
        const arr = [];
        for(let i=0; i<req.body.title.length; i++){
            const result = await collection.findOneAndUpdate(
                // 데이터베이스를 참고하여 작성해야함
                {_id : 'SEQ_ITEM1_NO'}, // 가지고 오기 위한 조건
                {$inc : {seq : 1}}       // seq값을 1증가시킴 
                );
                arr.push({
                    _id         : result.value.seq,
                    name        : req.body.title[i],
                    price       : Number(req.body.price[i]),
                    quantity    : Number(req.body.quantity[i]),
                    content     : req.body.content[i],
                    filename    : req.files[i].originalname,
                    filedata    : req.files[i].buffer,
                    filetype    : req.files[i].mimetype,
                    filesize    : Number(req.files[i].size),
                    regdate     : new Date(),
                    seller      : req.body.uid,
                    // checktoken에서 넣어줌 판매자를 넣어줘야함 
                });
        }
        console.log(arr); // 물품명, 가격, 수량, 내용
         // 추가할 컬렉션 선택
      const collection1 = dbconn.db(dbname).collection('item1');
      const result1    = await collection1.insertMany(arr);
      console.log(result1);
      if(result1.insertedCount === req.body.title.length){
          return res.send({status : 200});
      }
     
    return res.send({status : 0});
    }
    catch(e){
            console.error(e);
            res.send({status : -1, message:e});
    }
});

// 서버이미지 등록하기(n개)
// 물품에 따라서 개수가 다 다르다
// 게시판 원본글(게시글번호, 1개)------ 
// ------(N)개 달수 있음 원본글에 다는 댓글(게시판글번호 알아야함)
// 물품(물품번호, 1) ------- (N)서브이미지(물품번호)
// 물품하나에 여러개의 이미지
// localhost:3000/seller/subimage
router.post('/subimage',upload.array("image"),checkToken, async function(req, res, next){
    try {

        const code = Number(req.body.code); // 원본 물품 번호
        // [ {},{},{} ]
        // console.log(req.files);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');

        let arr = [];
        for(let i =0; i<req.files.length; i++){
            const result = await collection.findOneAndUpdate(
                { _id : 'SEQ_ITEMIMG1_NO'}, // 조건
                { $inc : {seq : 1}} // 1씩 증가
            )
            arr.push({
                _id         : result.value.seq,   //Pk 기본키
                filename    : req.files[i].originalname,
                filedata    : req.files[i].buffer,
                filetype    : req.files[i].mimetype,
                filesize    : req.files[i].size,
                itemcode    : code,    // FK 외래키 물품코드
                idx         : (i+1),   // 서브이미지 순서
                regdate     : new Date(),

            });
        }
            //[{},{},{}] => insertyMany(arr)
        
      const collection1 = dbconn.db(dbname).collection('itemimg1');
      const result1    = await collection1.insertMany(arr);
      console.log(result1);
      if(result1.insertedCount === req.files.length){
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











// ---------------------------------

// try{    
       
            
// }
  


// catch(e){
//     console.error(e);
//     res.send({status : -1, message:e});
// }
// });

