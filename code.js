// ==UserScript==
// @name         v2exMarkdown
// @version      0.67.2
// @description  为v2ex而生的markdown渲染
// @author       hundan
// @match        https://*.v2ex.com/t/*
// @require      https://cdn.staticfile.org/showdown/1.8.6/showdown.min.js
// @require      https://cdn.staticfile.org/fancybox/3.3.5/jquery.fancybox.min.js
// @grant        none
// @namespace https://github.com/hundan2020/v2exMarkdown
// ==/UserScript==

(function () {
    // jquery.js和highlight.js都由v2ex自身提供，不再向外部重复请求
    // 预处理以解决与 v2ex plus 的冲突
    $(".reply_content img").each(function(){
        var $this = $(this)
        if ($this[0].src.indexOf(".sinaimg.cn") != -1 && $this[0].src.indexOf("http://") != -1) {
            $this[0].src = "https" + $this[0].src.substr(4)
        }
    })
    // markdown处理
    var preFix = function(rawReply){
        var picRe = function(reply){
            reply = reply.replace(/(?:!\[.*?\])?!\[.*?\]\(\s*((?:https?)?:\/\/i\.loli\.net\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9]+.[a-z]+)\)|(https:\/\/i\.loli\.net\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9]+.[a-z]+)/ig, '![]( ' + encodeURI('$1$2') + ' )') // sm.ms
            reply = reply.replace(/(?:!\[.*?\])?!\[.*?\]\(\s*((?:https?)?:\/\/imgurl\.org\/temp\/\d{4}\/[a-z0-9]+\.[a-z0-9]+)\)|(https?:\/\/imgurl\.org\/temp\/\d{4}\/[a-z0-9]+\.[a-z0-9]+)/ig, '![]( ' + encodeURI('$1$2') + ' )') // 小z图床
            reply = reply.replace(/(?<!http:|https:)\/\/([a-z0-9]+\.sinaimg.cn\/(?:[a-z]+)\/[a-z0-9]+\.(?:jpg|png|gif|bmp))/ig, '![]( ' + encodeURI('https://$1') + ' )') // 新浪微博不规则图片链接
            //reply = reply.replace(/(?<!http:|https:)\/\/([a-z0-9]+\.sinaimg.cn\/(?:[a-z]+)\/[a-z0-9]+\.(?:jpg|png|gif|bmp))/ig, '![]( ' + encodeURI('https://$1') + ' )') // 新浪微博不规则图片链接
            return reply
        }
        var xssFilter = function(reply){
            var sReply = reply
            sReply = sReply.replace(/(!?\[.*?\]\(\s*?javascript.*?\))/igs, '`$1`')
            return sReply
        }
        var fixedReply = rawReply
        fixedReply = fixedReply.replace(/#(\d{1,3}\s)/ig, '&#x23;$1 ') // 避免楼层号加粗 safe
        fixedReply = fixedReply.replace(/(!\[(\S*?)\]\(\s+?)<a target="_blank" href="(\S+?)".*?><img src="(\S+?)" class="embedded_image".*?><\/a>\)+/ig, '![$2]($3)') // 正常显示的图片处理 safe
        fixedReply = fixedReply.replace(/&lt;img src="(.+?)" \/&gt;/ig, '$1') // 不规则图片链接处理 safe
        fixedReply = fixedReply.replace(/@<a href="\/member\/(\S+?)">(\S+?)<\/a>/ig, '@[$1](/member/$2)') // 论坛内@处理，考虑到代码段中的@应当正常显示 safe
        fixedReply = fixedReply.replace(/<a target="_blank" href="(\/t\/\d+)"\s*?(?:rel="nofollow")?>\/t\/\d+<\/a>/ig, '[$1]($1)') // 论坛内链处理，考虑到在代码段中应当正常显示 safe
        fixedReply = fixedReply.replace(/<a.*? href="(\S+?)".*?>(\S+?)<\/a>/ig, '$2') // 链接处理 safe
        fixedReply = fixedReply.replace(/\[!\[(\S+?)\]\(\s*(\S+?)\)\]\(\s*\S+?\)/ig, '![$1]($2)') // 不规则图片链接处理，不规则案例见 `https://www.v2ex.com/t/463469#r_5792042`
        fixedReply = fixedReply.replace(/(\n)?<br *\/?>/ig, "\n") // 换行处理，避免多行代码无法正常工作 safe
        fixedReply = picRe(fixedReply)
        fixedReply = xssFilter(fixedReply)
        return fixedReply
    }
    var endFix = function(markedReply){
        var fixedReply = markedReply
        fixedReply = fixedReply.replace(/\n/ig, '<br />') //safe markdown软回车转硬回车
        fixedReply = fixedReply.replace(/(<\/ul>|<\/li>|<\/p>|<\/table>|<\/h\d>)\s*<br\s*\/?>/ig, '$1') // safe 表格换行删除
        fixedReply = fixedReply.replace(/<br\s*\/?>(<li>|<ul>|<p>|<table>|<h\d>)/ig, '$1') // safe 表格换行删除
        fixedReply = fixedReply.replace(/(<\/?table>|<\/?tbody>|<\/?thead>|<\/?tr>|<\/?th>|<\/?td>)<br\s*\/?>/ig, '$1') // safe 表格换行删除
        fixedReply = fixedReply.replace(/(<br\s*\/?>\s*){2,}/ig, '<br />') // safe 多重换行转单行
        fixedReply = fixedReply.replace(/@\[(\S+?)\]\(\/member\/\S+\)/ig, '@$1') // 代码段中的@ 还原
        fixedReply = fixedReply.replace(/\[(\/t\/\d+)\]\(\/t\/\d+\)/ig, '$1') // 代码段中的内链还原
        fixedReply = fixedReply.replace(/&amp;/ig, '&') // 对重复转义的 & 进行还原，而不必对<>进行操作，有效的避免了XSS发生
        return fixedReply
    }
    var processMarkdown = function(){
        $("div.reply_content").each(function () {
            var reply = $(this)[0]
            var rawReply = reply.innerHTML
            var converter = new showdown.Converter({
                omitExtraWLInCodeBlocks: true,
                parseImgDimensions: true,
                simplifiedAutoLink: true,
                literalMidWordUnderscores: true,
                strikethrough: true,
                tables: true,
                ghCodeBlocks: true,
                tasklists: true,
                smoothLivePreview: true,
                ghCompatibleHeaderId: true,
                encodeEmails: true,
                emoji: true
            })
            var markedReply = converter.makeHtml(preFix(rawReply))
            reply.innerHTML = endFix(markedReply)
            reply.className = 'reply_content markdown_body'
            // 开启代码高亮
            hljs.configure({useBR: true})
           $('div.reply_content code').each(function(i, block) {
                hljs.highlightBlock(block)
            })
        })
    }
    processMarkdown()
    // 加载看图插件
    function loadStyle(url){
        var link = document.createElement('link')
        link.type = 'text/css'
        link.rel = 'stylesheet'
        link.href = url
        var head = document.getElementsByTagName('head')[0]
        head.appendChild(link)
    }
    loadStyle('https://cdn.staticfile.org/fancybox/3.3.5/jquery.fancybox.min.css')
    var a_wrap = $('<a></a>')
    var imgs = $('.markdown_body img, .topic_content img')
    imgs.wrap('<a></a>')
    $.each(imgs, function (i, j) {
        $(j).css({'max-height':'25vh'})
        // let a_src = $(this).attr('src').replace(/^(?:https?:)?(?:\/\/)?(\w+.sinaimg.cn\/)/, "https://$1")
        $(j).parent().attr('id', 'img' + i).attr('href', $(this).attr('src'))
        console.log($(this).attr('src'))
        // 通过延迟解决与v2ex plus的冲突
        setTimeout(function(){
            $("#img" + i).fancybox({
                buttons: [
                    "slideShow",
                    "thumbs",
                    "close"
                ],
                'zoomSpeedIn': 300,
                'zoomSpeedOut': 300,
                'overlayShow': false,
                'overlayOpacity': 0.3
            })
        },500)
    })
    // 添加楼主标记
    let author = $('#Main > div:nth-child(2) > div.header > small > a').text()
    $('table > tbody > tr > td > strong > a').each(function(){
        if ($(this).text() == author){
            var sign = $('<span></span>')
            sign.text('楼主')
            sign.css({"padding": "1px 5px", "margin": "0 6px", "font-size": "x-small", "color": "#777", "border-radius": "8px", "border": "1px solid"})
            $(this).parent().after(sign)
        }
    })
    // 修复新浪外链
    $("img").each(function(){
    })
    window.refererBypass = `
<script src="https://cdn.staticfile.org/jquery/3.4.0/jquery.min.js">
<\/script>
<script>
$(parent.document).find("img").each(function(){
    //let img_src = $(this).attr("src").replace(/^(?:https?:)?(?:\\\/\\\/)?(\\w+.sinaimg.cn\\\/)/, "https:\/\/\$1")
    let img_src = $(this).attr("src")
    let preload_img = \`<img src="\$\{img_src\}" />\`
    document.write(preload_img)
})
$('img').on('load', function () {
	//console.log(this.src)
	$(parent.document).find('img[src$="'+this.src+'"]').each(function () {
		this.src = this.src
	})
})
<\/script>
`
    $('body').append('<iframe src="javascript:parent.refererBypass;" style="display: none;"></iframe>')
    $(function(){
        setTimeout(function(){
            console.clear()
            console.log("\n\n\n Thanks for using my script~\n\n\n\n")
        }, 2000)
    })
})()
