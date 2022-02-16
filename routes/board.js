var express = require('express');
var router = express.Router();

//CMD > npm i mongodb --save
const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

//CMD > npm i multer --save
const multer = require('multer');
const upload = multer({storage:multer.memoryStorage()});

//조회 : await axios.get(url, {headers:headers});
//추가 : await axios.post(url, body, {headers:headers});
//수정 : await axios.put(url, body, {headers:headers});
//삭제 : await axios.delete(url, {headers:headers, data:{}});

// Post   : insert
// Put    : update
// Delete : delete
// Get    : select...

// localhost:3000/board/insert
// insert - title, content, writer, image 
// _id, regdate
// 게시판 글쓰기
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

       return res.send({status : 200 , rows:result, total : result1})
    }
      

    
    catch(e){
        console.error(e);
        res.send({status : -1, message:e});
    }
});


// 게시판 상세 내용
// localhost:3000/board/selectone?no=123
router.get('/selectone', async function(req, res, next) {
try{    
    // 1. 전송되는 값 받기(형변환에 주의)
    const no = Number(req.query.no);

    // 2.  db연결, db선택, 컬렉션 선택
    const dbconn = await db.connect(dburl); //연결
    const collection = dbconn.db(dbname).collection('board1');

    // 3. db에서 원하는 값 가져오기(fine one -> 1개만 가져오기 or find(n개 개져오기))
    // 글번호 하나만 가져오면 되므로 fineone 사용
    const result = await collection.findOne(
        {_id : no}, // 조건
        {projection : {filename : 0, filedata : 0, filesize : 0 , filetype : 0}}, // 필요한 컬럼만
        );

        // 4. 가져온 정보에서 db에서 이미지 정보를 수동으로 추가함
        // 이미지 URL, 이전글번호, 다음글번호
        result['imageurl'] = '/board/image?_id=' + no;

        // 120
        // 121
        // 122 이전글
        // 123 <= 현재 요청되는 글 번호 위치
        // 124 다음글

        // {_id : {$lt : 123} }  //123미만
        // {_id : {$lte : 123} } //123이하
        // {_id : {$gt : 123} }  //123초과
        // {_id : {$gte : 123} } //123이상
        

        const prev = await collection.find(
            {_id : {$lt : no} },      // 조건
            { projection : {_id : 1}} // 필요한 컬럼만
            ).sort({_id : -1}).limit(1).toArray(); // -1 : 내림차순, 1 : 오름차순
            const next = await collection.find(
                {_id : {$gt : no} },      // 조건
                { projection : {_id : 1}} // 필요한 컬럼만
                ).sort({_id : 1}).limit(1).toArray(); // -1 : 내림차순, 1 : 오름차순
        
            

            
        console.log(prev); // 결과 => [ { _id: 122 } ]  OR [] <- 이전글이 업을때
        console.log(next);
        console.log(result); // 개발자 확인용도

        if(prev.length > 0 ){ // 이전글이 존재한다면
            result['prev'] = prev[0]._id;
        }
        else { // 이전글이 없다면
            result['prev'] = 0;
        }
       
        if(next.length === 1 ){ // 이전글이 존재한다면
            result['next'] = next[0]._id;
        }
        else { // 다음글이 없다면
            result['next'] = 0;
        }

        // 같은것 : find ( {_id : 123}) , find({_id : {$eq : 123}}) 일치하는 것 가져오기
        // 같지 않은것 : find({_id : {$ne: 123} }) 123이 아닌것을 가져오기
        // 포함 : find({_id : {$in:[123,124,125]} } ) 포함하는것 가져오기

        // 조건2개 일치 and
        // find ({id:123, hit:34}) 
        // find({$and : [{_id : 123}, {hit:77} ] } )

        // 조건 2개중 하나만 만족하면 가져오기 or 
        // find({$or : [{_id : 123}, {hit:34} ] } )
        res.send({status : 200, result:result}); // 프론트로 전달함
            
}

catch(e){
    console.error(e); // 개발자가 확인하는 용도
    res.send({status : -1, message:e});  // 프론트로 전달함.
}
});

// 조회수 5씩증가.
// localhost:3000/board/updatehit?no=123
router.put('/updatehit', async function(req, res, next) {
    try{    
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db연동
        const dbconn = await db.connect(dburl); //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 조회수 증가
        const result = await collection.updateOne(
            {_id : no }, //조건
            {$inc : {hit : 5}}, //실제 수행할 내용 hit 를 10씩 증가시킴
        );
        console.log(result);
        // 4. DB수행 후 반환되는 결과 값에 따라 적절한 갑을 전달 
        if(result.modifiedCount === 1){ //modifiedCount => 수정된 갯수
            return res.send({status : 200}); // 프론트로 전달함
        }
        return res.send({status : 0});
                
    }
    
    catch(e){
        console.error(e); // 개발자가 확인하는 용도
        res.send({status : -1, message:e});  // 프론트로 전달함.
    }
    });

// 글 삭제
// localhost:3000/board/delete?no=123
router.delete('/delete', async function(req, res, next) {
    try{    
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db연동
        const dbconn = await db.connect(dburl); //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 삭제 수행
        const result = await collection.deleteOne(
            {_id : no }, //조건
        );

        // 4. 결과 반환
        if(result.deletedCount === 1){
            return res.send({status : 200});
        }
        return res.send({status : 0});
                
    }
    
    catch(e){
        console.error(e); // 개발자가 확인하는 용도
        res.send({status : -1, message:e});  // 프론트로 전달함.
    }
    });


// 글 수정 : 글 번호(조건), 글제목, 내용, 작성자
// localhost:3000/board/update?no=123
router.put('/update', async function(req, res, next) {
    try{    
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);    // query
        const title = req.body.title;       // body
        const content = req.body.content;   // body
        const writer = req.body.writer;     // body

        // 2. db연동
        const dbconn = await db.connect(dburl); //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 변경 수행
        const result = await collection.updateOne(
            {_id : no }, //조건
            {$set : {title : title, content : content, writer : writer} }
        );
        
        // 4. 결과 반환
        if(result.modifiedCount === 1){
            return res.send({status : 200});
        }
        return res.send({status : 0});
                
    }
    
    catch(e){
        console.error(e); // 개발자가 확인하는 용도
        res.send({status : -1, message:e});  // 프론트로 전달함.
    }
    });

// 답글 쓰기
// 기본키 : 답글번호(x) - 줄별 데이터를 구분하는 고유한 값
// 내용, 작성자,    -데이터
// 외래키 : 원본 글번호 - 다른곳(board1의 글번호) 로만 사용가능
// 등록일(x)        -데이터
// localhost:3000/board/insertreply
router.post('/insertreply', async function(req, res, next) {
    try{    
         //1. DB접속, DB선택 및 컬렉션 선택
         const dbconn = await db.connect(dburl);
         const collection = dbconn.db(dbname).collection('sequence');

         const result = await collection.findOneAndUpdate(
             // 데이터베이스를 참고하여 작성해야함
             {_id : 'SEQ_BOARDREPLY1_NO'}, // 가지고 오기 위한 조건
             {$inc : {seq : 1}}       // seq값을 1증가시킴 
         );

         const obj = {
             _id     : result.value.seq,           // 기본키(PK) - 답글번호
             content : req.body.content,           // 답글 내용
             writer :  req.body.writer,            // 답글작성자
             boardno : Number(req.body.boardno),   // 외래키(Fk) - 원본 글번호
             regdate : new Date()                  // 답글 작성일
         }
         // 시퀀스에 데이터가 들어가면 안된다 
         const collection1 = dbconn.db(dbname).collection('boardreply1');
         const result1 = await collection1.insertOne(obj);

         //결과 확인
         if(result1.insertedId === result.value.seq){
             return res.send({status : 200})
         }
        return res.send({status : 0});
    }
    
    catch(e){
        console.error(e); // 개발자가 확인하는 용도
        res.send({status : -1, message:e});  // 프론트로 전달함.
    }
    });

// 답글 조회
// localhost:3000/board/selectreply?no=123
router.get('/selectreply', async function(req, res, next) {
    try{    
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db연결, db선택, 컬렉션선택
        const dbconn = await db.connect(dburl); //연결
        const collection = dbconn.db(dbname).collection('boardreply1');

        // 3. db에서 원하는 값 가져오기 (findOne (1개) or find(n개))
        const result = await collection.find(
            {boardno : no }, //조건
        ).toArray();

        //4. 전달하기
        return res.send({status : 200, result:result});
                
    }
    
    catch(e){
        console.error(e); // 개발자가 확인하는 용도
        res.send({status : -1, message:e});  // 프론트로 전달함.
    }
    });
    // 답글 삭제
    // localhost:3000/board/deletereply?_id=2
    router.delete('/deletereply', async function(req, res, next) {
        try{    
            // 1. 전달되는 값 받기
            const id = Number(req.query._id);
    
            // 2. db연결, db선택, 컬렉션선택
            const dbconn = await db.connect(dburl); //연결
            const collection = dbconn.db(dbname).collection('boardreply1');
    
            // 3. db에서 원하는 값 가져오기 (findOne (1개) or find(n개))
            const result = await collection.deleteOne(
                {_id : id }, //조건
            );
            console.log(result);
            if(result.deletedCount === 1){
                return res.send({status:200});
            }
            return res.send({status : 0})  // 삭제를 못한경우
        }
    
        catch(e){
            console.error(e); // 개발자가 확인하는 용도
            res.send({status : -1, message:e});  // 프론트로 전달함.
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