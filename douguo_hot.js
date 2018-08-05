const fs = require('fs')
const cheerio = require('cheerio')
const mysql = require('mysql')
const eventproxy = require('eventproxy')
const express = require('express')
const app = express()
const superagent = require('superagent')
require('superagent-charset')(superagent)
const async = require('async');
var schedule = require('node-schedule'); //定时任务

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'test',
    port: 3306
})

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

function scheduleCronstyle() {
    let counter = 1;
    let j = schedule.scheduleJob('1-10 * * * * *', function() {
        console.log('scheduleCronstyle:' + new Date() + '定时器出发次数：' + counter);
        counter++;
    });
    setTimeout(function() {
        console.log('定时器取消')
        j.cancel();
    }, 100);
}

function fetUrl(url, callback) {

    superagent.get(url)
        .charset('utf-8') //该网站编码为gbk，用到了superagent-charset
        .end(function(err, res) {
            let $ = cheerio.load(res.text)
            const arr = []

            $('.detail-step li').each(function(i, v) {
                arr.push(trim($(v).find('p').text()).toString())
            })
            const content = $(".detail-step").html()
            const obj = {
                id: url.replace(/[^0-9]/ig, ""),
                cook_id: url.replace(/[^0-9]/ig, ""),
                content: content
            }
            callback(null, obj) //将obj传递给第四个参数中的results
        })
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
}

function saveToMysql(results) {
    pool.query('delete from douguo', function(error, resultsc, fields) {

        if (error) throw error;
        results.some(function(result) {

            console.log(result)
            pool.query('insert into douguo set ?', result, function(err, result1) {
                if (err) throw err

            })
        })
    });


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
                    hot_cook_url: $(v).find('a').attr("href").split('.html')[0],
                    cook_id: +$(v).find('a').attr("href").replace(/[^0-9]/ig, "")
                };
                content.push(obj)

            })

            saveToMysqlHot(content)

            async.mapLimit(urls, 5, function(url, callback) {
                fetUrl(url, callback)
            }, function(err, results) {
                saveToMysql(results)
            })

        })
}


app.listen(3379, function() {
    console.log('server listening on 3379,数据爬取中')
    main(url)
})

scheduleCronstyle();