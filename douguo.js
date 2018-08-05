//抓取页面地址
/**
 * Created by 12 on 2017/7/4.
 */
const fs = require('fs')
const cheerio = require('cheerio')
const mysql = require('mysql')
const eventproxy = require('eventproxy')
const express = require('express')
const app = express()
const superagent = require('superagent')
require('superagent-charset')(superagent)
const async = require('async');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test',
    port: 3306
})

// let num = 1  //第几本书开始，失败后根据提示更改此处即可

// const urlList = require('./urls-douguo')
// let urlId = num //第几本书 +1
// let url = urlList[urlId - 1]  //url地址
// let total = 0 //总章节数
let id = 0 //计数器

let domain = "https://m.douguo.com"

let url = require('./urls-douguo')



function trim(str) {
    return str.replace(/(^\s*)|(\s*$)/g, '').replace(/&nbsp;/g, '')
}

//将Unicode转汉字
function reconvert(str) {
    str = str.replace(/(&#x)(\w{1,4});/gi, function($0) {
        return String.fromCharCode(parseInt(escape($0).replace(/(%26%23x)(\w{1,4})(%3B)/g, "$2"), 16));
    });
    return str
}




function fetUrl(url, callback, id) {
    superagent.get(url)
        .charset('utf-8') //该网站编码为gbk，用到了superagent-charset
        .end(function(err, res) {
            let $ = cheerio.load(res.text)
            const arr = []

            $('.detail-step li').each(function(i, v) {
                arr.push(trim($(v).find('p').text()).toString())
            })
            const content = $(".detail-step").html()
            //分析结构后分割html
            // const contentArr = content.split('。')
            // contentArr.forEach(elem => {
            //   const data = trim(elem.toString())
            //   arr.push(data)
            // })
            const obj = {
                id: id,
                title: '122',
                content: content //由于需要保存至mysql中，不支持直接保存数组，所以将数组拼接成字符串，取出时再分割字符串即可,mysql中varchar最大长度，可改为text类型
            }
            callback(null, obj) //将obj传递给第四个参数中的results
        })
}

function saveToMysql(results) {
    pool.query('delete from douguo', function(error, resultsc, fields) {

        if (error) throw error;

        // id = 0

        results.some(function(result) {
            pool.query('insert into douguo set ?', result, function(err, result1) {
                if (err) throw err

            })
        })
    });


}

function saveToMysqlHot(results) {
    pool.query('delete from douguo_hot', function(error, resultsc, fields) {
        if (error) throw error;

        results.some(function(result) {
            pool.query('insert into douguo_hot set ?', result, function(err, result1) {
                if (err) throw err

            })
        })

    })
    // pool.query('delete from douguo_hot',function(error,resultsc,fields){

    //       if (error) throw error;

    //       id = 0

    //       results.some(function (result) {
    //         pool.query('insert into douguo_hot set ?', result, function (err, result1) {
    //           if (err) throw err

    //         })
    //       })

    // })
}

function main(url) {
    superagent.get(url)
        .charset('utf-8') //该网站编码为gbk，用到了superagent-charset
        .end(function(err, res) {
            var $ = cheerio.load(res.text); //res.text为获取的网页内容，通过cheerio的load方法处理后，之后就是jQuery的语法了

            /*需要抓取的详情页地址*/
            let urls = []

            let content = []
            total = $('.feed-recipe .menu-content').length
            $('.feed-recipe .menu-content').each(function(i, v) {
                urls.push(domain + $(v).find('a').attr('href'))

                let obj = {
                    id: i + 1,
                    menu_name: $(v).find('.menu-name').text(),
                    text_lips: $(v).find('.text-lips').text(),
                    hot_cook_pic: $(v).find('.hot-cook-pic').attr('style').split('(')[1].replace(')', ''),
                    hot_cook_url: $(v).find('a').attr("href"),
                    cook_id: +$(v).find('a').attr("href").replace(/[^0-9]/ig, "")
                };
                content.push(obj)

            })

            saveToMysqlHot(content)

            async.mapLimit(urls, 5, function(url, callback) {
                id++
                fetUrl(url, callback, id) //需要对章节编号，所以通过变量id来计数
            }, function(err, results) {
                //先把数据库清空了
                console.log("这是抓取的详情页的内容：")
                console.log(url)
                console.log(results)

                saveToMysql(results)
            })


        })
}


app.get('/', function(req, res, next) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h2 style="font-size:12px;color:#333333;">正在爬取数据</h2>`)
    main(url)
})

app.listen(3379, function() {
    console.log('server listening on 3379')
})