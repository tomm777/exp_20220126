const jwt = require('jsonwebtoken');

const self = module.exports = {
    securitykey : 'sifh3gf9usg932guo',
    option : {
        algorithm : 'HS256', // 알고리즘
        expiresIn : '10h',   // 만료시간
        issuer    : 'DS'     // 발행자
    },

    // 토큰의 유효성 검사를 위한 함수, authfilter
    checkToken : async(req, res, next) => {
        try {
            const token = req.headers.token;
            if(!token){
                return res.send({status : -1, result:'토큰없음'});
            }
            // 토큰에서 필요한 값을 추출
            // 토큰 생성시 사용했던 securitykey가 필요
            const user =jwt.verify(token, self.securitykey);

            if(typeof user.uid === 'undefined'){
                return res.send({status : -1, result:'정보추출불가'})
            }
            if(typeof user.uname === 'undefined'){
                return res.send({status : -1, result:'정보추출불가'})
            }

            // 추출이 가능하다면 req.body에 임의의 키값으로 추가함
            // 로그인에서 토큰에 포함한 정보를 복원
            req.body.uid = user.uid;
            req.body.uname = user.uname;
            req.body.urole  = user.urole

            // member.js의 router가 동작됨
            next();
        }
        catch(e){
            if(e.message === 'invalid signature'){
                return res.send({status : -1, result:'인증실패'});
            }
            if(e.message === 'jwt expired'){
                return res.send({status : -1, result:'시간만료'});
            }
            if(e.message === 'invalid token'){
                return res.send({status : -1, result:'유효하지 않는 토큰'});
            }
                return res.send({status : -1, result:'토큰오류'});
        }
    }
}