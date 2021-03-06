var express = require('express');
var router = express.Router();

const checkToken = require('../config/auth').checkToken;


// 참고 : https://github.com/mongodb/node-mongodb-native
// CMD> npm i mongodb --save
const db     = require('mongodb').MongoClient;
const dburl  = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

const itemCount = 16;  // 한페이지에 보여줄 개수


// 장바구니 목록
// localhost:3000/shop/selectcart
router.get('/selectcart',  async function(req, res, next) {
    try{    

        const dbconn = await db.connect(dburl);
        const userid = req.headers['x-forwarded-for'];

        // cart1에서 현재 접속한 구매자 ip정보에 해당하는 목록 받기
        const collection = dbconn.db(dbname).collection('cart1');
        const result = await collection.find(
            { userid : userid }, // 가지고 오기 위한 조건
        ).toArray(); 
        const collection1 = dbconn.db(dbname).collection('item1');
        // 받은 목록에 물품번호를 꺼내서 item1에 정보를 가져와 합치기
        for(let i =0;i<result.length;i++){
            const result1 = await collection1.findOne(
                {_id : result[i].code},
                {projection : { price : 1, name : 1}}
                )
                // 합치는 부분
                result[i].itemname = result1.name;
                result[i].itemprice = result1.price;
        }
            console.log(result);
            return res.send({status : 200, result:result})
        }
  catch(e){
      console.error(e);
      res.send({status : -1, message:e});
  }
  });

//장바구니
// localhost:3000/shop/insertcart
router.post('/insertcart',  async function(req, res, next) {
    try{    
        console.log(req.headers['x-forwarded-for']);
        console.log(req.body);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');
        const result = await collection.findOneAndUpdate(
            { _id : 'SEQ_CART1_NO' }, // 가지고 오기 위한 조건
            { $inc : {seq : 1 } }      // seq값을 1증가씨킴
        );

        const obj = {
            // 시퀀스에서 가져온 값
            _id  : result.value.seq,
            // 구매자가 접속한 PC의 ip주소를 사용
            userid : req.headers['x-forwarded-for'],
            code : Number(req.body.code),
            cnt : Number(req.body.cnt),

        }

        const collection1 = dbconn.db(dbname).collection('cart1');
        const result1 = await collection1.insertOne(obj);
        if(result1.insertedId === obj._id){
            return res.send({status : 200})
        }
        return res.send({status : 0});
  }
      
  catch(e){
      console.error(e);
      res.send({status : -1, message:e});
  }
  });

// 주문 일괄 취소
// localhost:3000/shop/orderdelete
router.delete('/orderdelete',checkToken, async function(req, res, next){
    try {
        // {"code":[1021,1022]}
        const code = req.body.chk;
        console.log(code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');

       // { $in : [1,2,3,4] } 포함 된 항목
       const result = await collection.deleteMany(
        { _id : {$in : code},
            orderid  : req.body.uid}
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

// 주문목록 리스트
// localhost:3000/shop/orderlist
router.get('/orderlist', checkToken, async function(req, res, next) {
    try{
        const email = req.body.uid;
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');

        const result = await collection.find(
            { orderid : email  },
            { projection : 
                { 
                    orderstep : 0, 
                    orderid   : 0,
                }
            }
        ).toArray();


        const collection1 = dbconn.db(dbname).collection('item1');        
        for(let i=0;i<result.length;i++){
            const result1 = await collection1.findOne(
                { _id : result[i].itemcode },
                { projection : 
                    { 
                        name : 1, 
                        price: 1,
                        quantity : 1,
                    }
                }
            );

            result[i]['itemname']   = result1['name'];
            result[i]['itemprice']  = result1['price'];
            result[i]['quantity']  = result1['quantity'];
        }

        return res.send({status:200, result:result});
    }
    catch(e){
        console.error(e);
        return res.send({status:-1, message:e});
    }
});


// // 시간대별 주문수량
// // localhost:3000/shop/grouphour
// router.get('/grouphour',  async function(req, res, next) {
//     try{  
//         // 판매자 토큰
//         const email = req.body.uid;

//         // 물품에서 판매자가 email과 같은것 => 물품코드 
//         const collection = dbconn.db(dbname).collection('item1');
//         // 고유값 꺼내기 distinct(고유한 값 컬럼명, 조건)
//         const result = await collection.distinct("_id",
//                 {seller : email});
//         // [100,200]
//         console.log('grouphour',result);

//         const collection1 = dbconn.db(dbname).collection('order1');

//         const result1 = await collection1.aggregate([
//             {
//                 $match : {
//                     itemcode : {$in: result}
//                 }
//             },
//             {
//             $project : {    // 가져올 항목 ( 물품코드, 주문수량)
//                 orderdate : 1,  // 주문일자
//                 ordercnt  : 1,  // 주문수량
//                 month : {$month : '$orderdate'},    // 주문일자를 이용해서 달
//                 hour  : {$hour  : '$orderdate'},    // 주문일자를 이용해서 시
//                 minute : {$minute  : '$orderdate'}, // 주문일자를 이용해서 분

//             }
//         },
//         {
//             $group : {
//                 _id : '$hour', // 그룹할 항목
//                 count : {
//                     $sum : '$ordercnt'
//                 }
//             }

//             },
            

//      ]).toArray();

//     return res.send({status : 200,result:result1});
        
  
//     }
//         catch(e){
//             console.error(e);
//             res.send({status : -1, message:e});
//         }
//         });

// 상품별 주문수량(판매자 정보가 필요함)
// localhost:3000/shop/groupitem?code=1047
// item1(판매자내용만 꺼냄) + order1에 itemcode가 일치하는 것만
router.get('/groupitem',checkToken, async function(req, res, next) {
    try{
        // 판매자 토큰
        const email = req.body.uid;
        const dbconn = await db.connect(dburl);

        // 물품에서 판매자가 email과 같은것 => 물품코드 
        const collection = dbconn.db(dbname).collection('item1');
        // 고유값 꺼내기 distinct(고유한 값 컬럼명, 조건)
        const result = await collection.distinct("_id",
                {seller : email});
        // [100,200]
        console.log('groupitem',result);

        const collection1 = dbconn.db(dbname).collection('order1');
        // 그룹별 통계 aggregate
        const result1 = await collection1.aggregate([
            {
                $match : {
                    itemcode : {$in: result}
                }
            },

            {
                $project : { //가져올 항목( 물품코드, 주문수량 )
                    _id : 1,
                    itemcode : 1,
                    ordercnt : 1
                }
            },
            
            {
                $group : {
                    _id     : '$itemcode', // 그룹할 항목
                    count   : {
                        $sum : '$ordercnt'
                    }
                }
            },
        ]).toArray();
        
        return res.send({status:200, result:result1});
    }
    catch(e){
        console.error(e);
        return res.send({status:-1, message:e});
    }
});

// 주문하기
// (FK) : 외래키
// _id       : (PK)고유번호) 주문번호 시퀀스 사용
// itemcode  : (FK) 물품내역(물품번호, 물품과 관련된 모든정보)
// ordercnt  : 주문수량
// orderid   : (FK) 주문자(이메일, 고객과 관련된 모든 정보)
// orderdate : 주문일자
// orderstep : 100(카트) 101(주문) 102(결제) 103(배송중) 104(배송완료)

// 주문목록(조인) :  member1 + item1 + order1
// 로그인사용자의 토큰, 물품번호, 주문수량
// localhost:3000/shop/order
router.post('/order', checkToken, async function(req, res, next) {
    try{    
         // DB연동
         const dbconn = await db.connect(dburl);
         const collection = dbconn.db(dbname).collection('sequence');
         const result = await collection.findOneAndUpdate(
             { _id : 'SEQ_ORDER1_NO' }, // 가지고 오기 위한 조건
             { $inc : {seq : 1 } }      // seq값을 1증가씨킴
         );
 
         const obj = {
             _id         : result.value.seq, //주문번호
             itemcode    : Number(req.body.itemcode), //물품번호
             ordercnt    : Number(req.body.ordercnt), //주문수량
             orderid     : req.body.uid,     // 주문자(토큰에서)
             orderdate   : new Date(), /* + (1000 * 60 * 60 * 9) *///9시간 더하기
             orderstep   : 101,
         }

        const collection1 = dbconn.db(dbname).collection('order1');
        const result1 = await collection1.insertOne(obj);
        if(result1.insertedId === obj._id){
            return res.send({status : 200});
        }
        return res.send({status : 0});
  }
      
  catch(e){
      console.error(e);
      res.send({status : -1, message:e});
  }
  });

// 상세화면 페이지
// localhost:3000/shop/selectone?code=1052
router.get('/selectone', async function(req, res, next) {
    try{    
         const code = Number(req.query.code);
         // DB연동
         const dbconn = await db.connect(dburl);
         const collection = dbconn.db(dbname).collection('item1');
          // SQL문(insrt, update, delete, select)
          // SQL문을 이용해서 DB연동 mybatis
          // SQL문을 저장소(함수)를 DB연동 jpa
         const result = await collection.findOne(
             {_id : code}, // 조건없음 전체가져오기
             {projection : {filedata : 0, filetype : 0,
               filename : 0, filesize : 0, regdate : 0}}
             )
             // find [{},{},{}]
             // findone {}
  
             
        result['imageUrl'] = `/shop/image?code=${code}`;
  
         return res.send({status : 200, result:result});
  }
      
  catch(e){
      console.error(e);
      res.send({status : -1, message:e});
  }
  });

//메인화면 페이지 판매순, 가격순, 할인률, 베스트
// localhost:3000/shop/select?page=1
router.get('/select', async function(req, res, next) {
  try{    
       const page = Number(req.query.page);
       // DB연동
       const dbconn = await db.connect(dburl);
       const collection = dbconn.db(dbname).collection('item1');
        // SQL문(insrt, update, delete, select)
        // SQL문을 이용해서 DB연동 mybatis
        // SQL문을 저장소(함수)를 DB연동 jpa
       const result = await collection.find(
           {}, // 조건없음 전체가져오기
           {projection : {filedata : 0, filetype : 0,
             filename : 0, filesize : 0, regdate : 0}}
           ).sort({ _id : 1})  // 정렬(물품코드를 오름차순으로)
           .skip((page-1)*16)  // 생략할 개수
           .limit (itemCount)  // 16
           .toArray();

           // for =>[ {0}, {1}, {2}] => 위치를 i로 반복
        //    for(let i=0;i<result.length;i++){
        //        result[i]['imageUrl'] = `/shop/image?code=${result[i]._id}`
        //    }
           // foreach => [{}, {},{}]
           for(let tmp of result){
               tmp['imageUrl'] = `/shop/image?code=${tmp._id}`
           }

       return res.send({status : 200, result:result});
}
    
catch(e){
    console.error(e);
    res.send({status : -1, message:e});
}
});
// 이미지 가져오기
// localhost:3000/shop/image?code=1
router.get('/image', async function(req, res, next) {
    try {
        const code  = Number(req.query.code);

        // db연결
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        // 조회하면 나오는 키정보확인
        const result = await collection.findOne(
            { _id : code }, //조건
            { projection : { filedata:1, filename:1, filetype:1, filesize:1 } } 
        );

        res.contentType(result.filetype);
        return res.send(result.filedata.buffer);
    }
    catch(e) {
        console.error(e);
        return res.send({status : -1, message:e});
    }
});




// try{    
       
            
// }
  


// catch(e){
//     console.error(e);
//     res.send({status : -1, message:e});
// }
// });


module.exports = router;
