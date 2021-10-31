
function converCookieStr(cookieStr) {
    const list = cookieStr.split(';');
 
    const cookieObj = list.map((value) => {
        const obj = value.split('=');
        return {
            name: (obj[0]).trim(),
            value: (obj[1]).trim(),
            domain: '.163.com'
        }
    })
    
    // console.log(cookieObj);

    return cookieObj;
}

module.exports = converCookieStr;
