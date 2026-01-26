/**
 * Supabase 数据库检查脚本
 * 用于查看数据库表结构和内容
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zgteuwwhiwfglrvjcekq.supabase.co'
const supabaseAnonKey = 'sb_publishable_ths2W9m7xVW9GB-t-MxYhg_Nm0kTJmA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectDatabase() {
    console.log('🔍 开始检查 Supabase 数据库...\n')
    console.log('='.repeat(80))

    // 1. 检查 categories 表
    console.log('\n📁 1. Categories (内容大类表)')
    console.log('-'.repeat(80))
    try {
        const { data, error, count } = await supabase
            .from('categories')
            .select('*', { count: 'exact' })

        if (error) {
            console.log('❌ 错误:', error.message)
        } else {
            console.log(`✅ 总记录数: ${count}`)
            console.log('📋 数据示例:')
            console.table(data?.slice(0, 5))
        }
    } catch (e) {
        console.log('⚠️  表可能不存在或无权限访问')
    }

    // 2. 检查 communities 表
    console.log('\n📁 2. Communities (子社区表)')
    console.log('-'.repeat(80))
    try {
        const { data, error, count } = await supabase
            .from('communities')
            .select('*', { count: 'exact' })
            .limit(5)

        if (error) {
            console.log('❌ 错误:', error.message)
        } else {
            console.log(`✅ 总记录数: ${count}`)
            console.log('📋 数据示例:')
            console.table(data)
        }
    } catch (e) {
        console.log('⚠️  表可能不存在或无权限访问')
    }

    // 3. 检查 production_posts 表
    console.log('\n📁 3. Production Posts (精选帖子表)')
    console.log('-'.repeat(80))
    try {
        const { data, error, count } = await supabase
            .from('production_posts')
            .select('id, title_en, title_cn, subreddit, upvotes, image_type, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .limit(5)

        if (error) {
            console.log('❌ 错误:', error.message)
        } else {
            console.log(`✅ 总记录数: ${count}`)
            console.log('📋 最新5条帖子:')
            console.table(data)

            // 统计不同图片类型
            const { data: stats } = await supabase
                .from('production_posts')
                .select('image_type')

            if (stats) {
                const typeCounts = stats.reduce((acc, item) => {
                    acc[item.image_type] = (acc[item.image_type] || 0) + 1
                    return acc
                }, {})
                console.log('\n📊 图片类型统计:')
                console.table(typeCounts)
            }
        }
    } catch (e) {
        console.log('⚠️  表可能不存在或无权限访问:', e.message)
    }

    // 4. 检查 comments 表
    console.log('\n📁 4. Comments (评论表)')
    console.log('-'.repeat(80))
    try {
        const { data, error, count } = await supabase
            .from('comments')
            .select('id, post_id, author, depth, upvotes, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .limit(5)

        if (error) {
            console.log('❌ 错误:', error.message)
        } else {
            console.log(`✅ 总记录数: ${count}`)
            console.log('📋 最新5条评论:')
            console.table(data)

            // 统计评论深度分布
            const { data: depthStats } = await supabase
                .from('comments')
                .select('depth')

            if (depthStats) {
                const depthCounts = depthStats.reduce((acc, item) => {
                    const depth = `深度${item.depth}`
                    acc[depth] = (acc[depth] || 0) + 1
                    return acc
                }, {})
                console.log('\n📊 评论深度分布:')
                console.table(depthCounts)
            }
        }
    } catch (e) {
        console.log('⚠️  表可能不存在或无权限访问:', e.message)
    }

    // 5. 检查 RPC 函数
    console.log('\n🔧 5. 检查 RPC 函数')
    console.log('-'.repeat(80))
    try {
        const { data, error } = await supabase.rpc('get_random_posts', {
            limit_count: 3
        })

        if (error) {
            console.log('❌ get_random_posts RPC 错误:', error.message)
        } else {
            console.log('✅ get_random_posts RPC 正常工作')
            console.log(`📋 返回了 ${data?.length || 0} 条随机帖子`)
            if (data && data.length > 0) {
                console.table(data.map(p => ({
                    id: p.id.substring(0, 8) + '...',
                    title: p.title_en.substring(0, 50) + '...',
                    subreddit: p.subreddit
                })))
            }
        }
    } catch (e) {
        console.log('⚠️  RPC 函数可能不存在:', e.message)
    }

    // 6. 获取表结构信息（使用系统表）
    console.log('\n📋 6. 数据库Schema信息')
    console.log('-'.repeat(80))

    const tables = ['categories', 'communities', 'production_posts', 'comments']

    for (const tableName of tables) {
        console.log(`\n🔸 ${tableName} 表字段:`)
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1)

            if (data && data.length > 0) {
                const fields = Object.keys(data[0])
                console.log(`   字段列表: ${fields.join(', ')}`)
            } else if (!error) {
                console.log('   ⚠️  表为空，无法获取字段信息')
            }

            if (error) {
                console.log(`   ❌ ${error.message}`)
            }
        } catch (e) {
            console.log(`   ⚠️  ${e.message}`)
        }
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ 数据库检查完成！\n')
}

// 运行检查
inspectDatabase().catch(console.error)
