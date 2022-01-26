var express = require('express');
var router = express.Router();

//CMD > npm i mongodb --save
const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

//CMD > npm i multer --save
const multer = require('multer');
const upload = multer({storage:multer.memoryStorage()});

// Post   : insert
// Put    : update
// Delete : delete
// Get    : select...

// localhost:3000/board/insert
// insert - title, content, writer, image 
// _id, regdate
router.post('/insert', upload.single("image"),
             async function(req, res, next) {
    try{    
        //1. DB접속 
        const dbconn = await db.connect(dburl);
        //2. DB선택 및 컬렉션 선택
        const collection = dbconn.db(dbname).collection('sequence');
        //3. 시퀀스에서 값을 가져오고, 그 다음 위해서 증가
        const result = await collection.findOneAndUpdate(
            // 데이터베이스를 참고하여 작성해야함
            {_id : 'SEQ_BOARD1_NO'}, // 가지고 오기 위한 조건
            {$inc : {seq : 1}}       // seq값을 1증가시킴 
        );
        console.log('-----------------------');
        // 4. 정상동작 유무를 위한 결과 확인
        console.log(result.value.seq);
        console.log('-----------------------');

        const obj = {
            _id       : result.value.seq,
            title     : req.body.title,
            content   : req.body.content,
            writer    : req.body.writer,
            hit       : 1,
            filename  : req.file.originalname,
            filedata  : req.file.buffer,
            filetype  : req.file.mimetype,
            filesize  : req.file.size,
            regdate   : new Date()

        };
        // 추가할 컬렉션 선택
        const collection1 = dbconn.db(dbname).collection('board1');
        //추가하기
        const result1    = await collection1.insertOne(obj);

        if(result1.insertedId === result.value.seq) {
            return res.send({status : 200});
        }
        return res.send({status : 0});



    }
    catch(e){
        console.error(e);
        res.send({status : -1, message:e});
    }
});


// localhost:3000/board/image?_id=113
router.get('/image', async function(req,res,next){
    try{    
        const no =Number(req.query['_id']);
        // const no = req.query._id

        // db연결, db선택, 컬렉션선택
        const dbconn = await db.connect(dburl); //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 이미지 정보 가져오기
        const result = await collection.findOne(
            {_id : no  },  //조건
            { projection : {filedata:1, filetype:1} },  //필요한 항목만 projection
            
        );
        // console.log(result);
        // application/json => image/png
        res.contentType(result.filetype);
        return res.send(result.filedata.buffer);

    }
    catch(e){
        console.error(e);
        res.send({status : -1, message:e});
    }
});


// localhost:3000/board/select?page=1&text= 검색어 //?뒤에 오는것 query
router.get('/select', async function(req, res, next) {
    try{    
       const page = Number(req.query.page); //페이지 번호
       const text = req.query.text; //검색어 
            

        // db연결, db선택, 컬렉션선택
       const dbconn = await db.connect(dburl);
       const collection = dbconn.db(dbname).collection('board1');
        // find().toArray()로 사용
        const result = await collection.find(
           // abc => a, b, c 위치상관없이 포함되면됨
           // { title : title }은 똑같아야함
           {title : new RegExp(text, 'i')},
           {projection : {_id:1, title:1, writer:1,hit :1, regdate:1} }
           // sort = 정렬 오름차순 내림차순 : -1
       ).sort({_id : -1})
       //페이지를 스킵할때마다 스킵의 갯수가 높아짐 1페이지-10스킵 2페이지-2스킵
       .skip( (page-1)*10 )
       .limit( 10 )
       .toArray(); 
       // 오라클,Mysql SQL문 => SELECT * FROM REDER BY _ID ESC... 나중에 배워야함

       // 결과확인 
       console.log(result);
        //검색어가 포함된 전체 개시물 개수 = 페이지네이션 번호 생성
       const result1 = await collection.countDocuments(
           {}
       );

       return res.send({status : 200 , rows:result, totla : result1})
    }
      

    
    catch(e){
        console.error(e);
        res.send({status : -1, message:e});
    }
});





//--------------------------------------------------------------------------
// try{    
       
            
// }
  


// catch(e){
//     console.error(e);
//     res.send({status : -1, message:e});
// }
// });



module.exports = router;