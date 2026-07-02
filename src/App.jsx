import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  Home,
  Landmark,
  PieChart,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Upload,
  WalletCards,
  X,
} from 'lucide-react'
import './App.css'

const STORAGE_KEY = 'pocket-ledger-state-v1'
const quickAmounts = [6, 12, 28, 50, 100, 200]
const expenseCategories = ['餐饮', '交通', '购物', '居家', '娱乐', '医疗', '其他']
const incomeCategories = ['工资', '副业', '红包', '理财', '退款', '其他']

const seedTransactions = [
  {
    id: 'seed-1',
    type: 'expense',
    amount: 28,
    category: '餐饮',
    note: '午饭',
    date: todayISO(),
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'seed-2',
    type: 'expense',
    amount: 6,
    category: '交通',
    note: '地铁',
    date: todayISO(),
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: 'seed-3',
    type: 'income',
    amount: 4200,
    category: '工资',
    note: '本月工资',
    date: todayISO(),
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
  },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function currentMonthISO() {
  return todayISO().slice(0, 7)
}

function yuan(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value || 0)
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { transactions: seedTransactions, budget: 3000 }
    }
    const parsed = JSON.parse(raw)
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budget: Number(parsed.budget) || 3000,
    }
  } catch {
    return { transactions: seedTransactions, budget: 3000 }
  }
}

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [transactions, setTransactions] = useState(() => loadState().transactions)
  const [budget, setBudget] = useState(() => loadState().budget)
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    category: '餐饮',
    note: '',
    date: todayISO(),
  })
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, budget }))
  }, [transactions, budget])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
    }
  }, [])

  const stats = useMemo(() => buildStats(transactions, budget), [transactions, budget])
  const filteredTransactions = useMemo(() => {
    const keyword = search.trim()
    return transactions
      .filter((item) => {
        if (!keyword) return true
        return `${item.category}${item.note}${item.date}`.includes(keyword)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [search, transactions])

  function showToast(message, action) {
    setToast({ message, action })
    window.clearTimeout(showToast.timer)
    showToast.timer = window.setTimeout(() => setToast(null), 4200)
  }

  function submitTransaction(event) {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setFormError('请输入大于 0 的金额')
      return
    }

    const nextItem = {
      id: crypto.randomUUID(),
      type: form.type,
      amount,
      category: form.category,
      note: form.note.trim(),
      date: form.date,
      createdAt: Date.now(),
    }
    setTransactions((items) => [nextItem, ...items])
    setForm((current) => ({
      ...current,
      amount: '',
      note: '',
      date: todayISO(),
    }))
    setFormError('')
    setSearch('')
    setActiveTab('home')
    showToast('已保存这一笔')
  }

  function changeType(type) {
    setForm((current) => ({
      ...current,
      type,
      category: type === 'expense' ? expenseCategories[0] : incomeCategories[0],
    }))
  }

  function deleteTransaction(id) {
    const deleted = transactions.find((item) => item.id === id)
    if (!deleted) return

    setTransactions((items) => items.filter((item) => item.id !== id))
    showToast('已删除一笔账单', {
      label: '撤销',
      onClick: () => {
        setTransactions((items) => [deleted, ...items].sort((a, b) => b.createdAt - a.createdAt))
        setToast(null)
      },
    })
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ transactions, budget }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `记账备份-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(url)
    showToast('备份文件已导出')
  }

  function importData(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (Array.isArray(parsed.transactions)) {
          setTransactions(parsed.transactions)
          setBudget(Number(parsed.budget) || 3000)
          showToast(`已导入 ${parsed.transactions.length} 条账单`)
        } else {
          showToast('导入失败：文件格式不对')
        }
      } catch {
        showToast('导入失败：请确认是本应用导出的 JSON 文件')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function clearLedger() {
    if (!window.confirm('确定清空所有账单吗？建议先导出备份。')) return
    setTransactions([])
    setSearch('')
    showToast('账本已清空')
  }

  return (
    <main className="app-shell">
      <TopBar month={stats.monthLabel} />

      <section className="screen">
        {activeTab === 'home' && (
          <HomeView
            stats={stats}
            transactions={filteredTransactions.slice(0, 6)}
            search={search}
            setSearch={setSearch}
            onAdd={() => setActiveTab('add')}
            onDelete={deleteTransaction}
            totalCount={transactions.length}
          />
        )}
        {activeTab === 'add' && (
          <AddView
            form={form}
            setForm={setForm}
            formError={formError}
            setFormError={setFormError}
            changeType={changeType}
            submitTransaction={submitTransaction}
          />
        )}
        {activeTab === 'stats' && <StatsView stats={stats} />}
        {activeTab === 'settings' && (
          <SettingsView
            budget={budget}
            setBudget={setBudget}
            exportData={exportData}
            importData={importData}
            clearLedger={clearLedger}
            resetDemo={() => {
              setTransactions(seedTransactions)
              setSearch('')
              showToast('已恢复演示数据')
            }}
            transactionCount={transactions.length}
          />
        )}
      </section>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </main>
  )
}

function TopBar({ month }) {
  return (
    <header className="top-bar">
      <div>
        <p className="muted">我的账本</p>
        <h1>{month}</h1>
      </div>
      <div className="brand-mark" aria-hidden="true">
        <WalletCards size={22} />
      </div>
    </header>
  )
}

function HomeView({ stats, transactions, search, setSearch, onAdd, onDelete, totalCount }) {
  return (
    <>
      <section className={`balance-panel ${stats.budgetTone}`}>
        <div className="balance-row">
          <div>
            <p className="panel-label">本月结余</p>
            <strong>{yuan(stats.balance)}</strong>
          </div>
          <button className="add-button" type="button" onClick={onAdd} aria-label="记一笔">
            <Plus size={22} />
          </button>
        </div>
        <div className="metric-grid">
          <Metric label="收入" value={yuan(stats.income)} tone="income" icon={<ArrowDownLeft />} />
          <Metric label="支出" value={yuan(stats.expense)} tone="expense" icon={<ArrowUpRight />} />
          <Metric label="预算剩余" value={yuan(stats.remainingBudget)} tone="neutral" icon={<Landmark />} />
        </div>
        <div className="budget-meta">
          <span>{stats.budgetMessage}</span>
          <b>{stats.budgetPercent}%</b>
        </div>
        <div className="budget-line" aria-label={`预算使用 ${stats.budgetPercent}%`}>
          <span style={{ width: `${Math.min(stats.budgetPercent, 100)}%` }} />
        </div>
      </section>

      <div className="search-field">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索分类、备注或日期"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="清除搜索内容">
            <X size={16} />
          </button>
        )}
      </div>

      <SectionTitle title="最近账单" action={`${totalCount} 条本地保存`} />
      <TransactionList
        transactions={transactions}
        onDelete={onDelete}
        isFiltered={Boolean(search.trim())}
        onClearSearch={() => setSearch('')}
      />

      <SectionTitle title="本月支出分类" action="支出占比" />
      <CategoryPreview items={stats.categoryStats.slice(0, 4)} total={stats.expense} />
    </>
  )
}

function AddView({ form, setForm, formError, setFormError, changeType, submitTransaction }) {
  const categories = form.type === 'expense' ? expenseCategories : incomeCategories

  function setAmount(value) {
    setForm({ ...form, amount: String(value) })
    setFormError('')
  }

  return (
    <form className="entry-form" onSubmit={submitTransaction}>
      <div className="type-toggle" role="tablist" aria-label="收支类型">
        <button
          type="button"
          className={form.type === 'expense' ? 'selected' : ''}
          onClick={() => changeType('expense')}
        >
          支出
        </button>
        <button
          type="button"
          className={form.type === 'income' ? 'selected income' : ''}
          onClick={() => changeType('income')}
        >
          收入
        </button>
      </div>

      <label className="amount-field">
        <span>金额</span>
        <input
          inputMode="decimal"
          value={form.amount}
          onChange={(event) => {
            setForm({ ...form, amount: event.target.value })
            setFormError('')
          }}
          placeholder="0.00"
        />
      </label>
      {formError && <p className="form-error">{formError}</p>}

      <div className="quick-amounts" aria-label="常用金额">
        {quickAmounts.map((amount) => (
          <button type="button" key={amount} onClick={() => setAmount(amount)}>
            {yuan(amount)}
          </button>
        ))}
      </div>

      <div className="category-grid">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={form.category === category ? 'selected' : ''}
            onClick={() => setForm({ ...form, category })}
          >
            {category}
          </button>
        ))}
      </div>

      <label className="field">
        <span>备注</span>
        <input
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
          placeholder="比如：早餐、房租、打车"
        />
      </label>

      <label className="field">
        <span>日期</span>
        <input
          type="date"
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
        />
      </label>
      <div className="date-shortcuts">
        <button type="button" onClick={() => setForm({ ...form, date: todayISO() })}>
          今天
        </button>
        <button type="button" onClick={() => setForm({ ...form, date: addDays(-1) })}>
          昨天
        </button>
      </div>

      <button className="primary-action" type="submit">
        保存这一笔
      </button>
    </form>
  )
}

function StatsView({ stats }) {
  const [period, setPeriod] = useState('day')
  const periodViews = {
    day: {
      title: '每天支出',
      action: '最近 30 天',
      totalLabel: '今日支出',
      total: stats.todayExpense,
      rows: stats.dailyExpenseRows,
    },
    month: {
      title: '每月支出',
      action: '按月份汇总',
      totalLabel: '本月支出',
      total: stats.expense,
      rows: stats.monthlyExpenseRows,
    },
    year: {
      title: '每年支出',
      action: '按年份汇总',
      totalLabel: '今年支出',
      total: stats.yearExpense,
      rows: stats.yearlyExpenseRows,
    },
  }
  const currentView = periodViews[period]

  return (
    <>
      <section className={`stats-panel ${stats.budgetTone}`}>
        <div className="donut" style={{ '--percent': `${Math.min(stats.budgetPercent, 100)}%` }}>
          <span>{stats.budgetPercent}%</span>
        </div>
        <div>
          <p className="panel-label">本月预算使用</p>
          <h2>{yuan(stats.expense)} / {yuan(stats.budget)}</h2>
          <p className="muted">{stats.budgetMessage}</p>
        </div>
      </section>

      <div className="period-tabs" role="tablist" aria-label="支出周期">
        {Object.entries(periodViews).map(([key, view]) => (
          <button
            type="button"
            key={key}
            className={period === key ? 'selected' : ''}
            onClick={() => setPeriod(key)}
          >
            {view.title.replace('支出', '')}
          </button>
        ))}
      </div>

      <section className="period-summary">
        <span>{currentView.totalLabel}</span>
        <strong>{yuan(currentView.total)}</strong>
      </section>

      <SectionTitle title={currentView.title} action={currentView.action} />
      <div className="period-list">
        {currentView.rows.map((item) => (
          <div className="period-row" key={item.key}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.count} 笔</span>
            </div>
            <div className="rank-track">
              <span style={{ width: `${item.percent}%` }} />
            </div>
            <b>{yuan(item.amount)}</b>
          </div>
        ))}
      </div>

      <SectionTitle title="分类排行" action="本月支出" />
      <div className="rank-list">
        {stats.categoryStats.map((item) => (
          <div className="rank-row" key={item.category}>
            <div>
              <strong>{item.category}</strong>
              <span>{item.percent}%</span>
            </div>
            <div className="rank-track">
              <span style={{ width: `${item.percent}%` }} />
            </div>
            <b>{yuan(item.amount)}</b>
          </div>
        ))}
      </div>
    </>
  )
}

function SettingsView({
  budget,
  setBudget,
  exportData,
  importData,
  clearLedger,
  resetDemo,
  transactionCount,
}) {
  return (
    <div className="settings-list">
      <div className="settings-summary">
        <strong>{transactionCount}</strong>
        <span>条账单保存在本机浏览器</span>
      </div>
      <label className="field">
        <span>本月预算</span>
        <input
          inputMode="decimal"
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value) || 0)}
        />
      </label>
      <button className="settings-action" type="button" onClick={exportData}>
        <Download size={18} />
        导出 JSON 备份
      </button>
      <label className="settings-action file-action">
        <Upload size={18} />
        导入 JSON 备份
        <input type="file" accept="application/json" onChange={importData} />
      </label>
      <button className="settings-action" type="button" onClick={resetDemo}>
        <RotateCcw size={18} />
        恢复演示数据
      </button>
      <button className="settings-action danger" type="button" onClick={clearLedger}>
        <Trash2 size={18} />
        清空账本
      </button>
    </div>
  )
}

function Metric({ label, value, tone, icon }) {
  return (
    <div className={`metric ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SectionTitle({ title, action }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <span>{action}</span>
    </div>
  )
}

function TransactionList({ transactions, onDelete, isFiltered, onClearSearch }) {
  if (!transactions.length) {
    return (
      <div className="empty-state">
        <CalendarDays size={28} />
        <strong>{isFiltered ? '没有匹配账单' : '还没有账单'}</strong>
        <span>{isFiltered ? '换个关键词试试。' : '点底部“记账”开始记录。'}</span>
        {isFiltered && (
          <button type="button" onClick={onClearSearch}>
            清空搜索
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="transaction-list">
      {transactions.map((item) => (
        <article className="transaction-row" key={item.id}>
          <div className={`transaction-icon ${item.type}`}>
            {item.type === 'expense' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
          </div>
          <div className="transaction-main">
            <strong>{item.category}</strong>
            <span>{[item.note, formatDate(item.date)].filter(Boolean).join(' · ')}</span>
          </div>
          <div className={`transaction-amount ${item.type}`}>
            {item.type === 'expense' ? '-' : '+'}
            {yuan(item.amount)}
          </div>
          <button type="button" onClick={() => onDelete(item.id)} aria-label="删除账单">
            <Trash2 size={16} />
          </button>
        </article>
      ))}
    </div>
  )
}

function CategoryPreview({ items, total }) {
  return (
    <div className="category-preview">
      <div className="mini-donut" style={{ '--percent': `${items[0]?.percent || 0}%` }}>
        <span>{total ? yuan(total) : '暂无'}</span>
      </div>
      <div className="preview-bars">
        {items.map((item) => (
          <div className="preview-row" key={item.category}>
            <span>{item.category}</span>
            <div className="rank-track">
              <span style={{ width: `${item.percent}%` }} />
            </div>
            <b>{item.percent}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function BottomNav({ activeTab, setActiveTab }) {
  const items = [
    ['home', '首页', Home],
    ['add', '记账', Plus],
    ['stats', '统计', PieChart],
    ['settings', '设置', Settings],
  ]

  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map(([key, label, Icon]) => (
        <button
          type="button"
          key={key}
          className={activeTab === key ? 'selected' : ''}
          onClick={() => setActiveTab(key)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && (
        <button type="button" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="关闭提示">
        <X size={16} />
      </button>
    </div>
  )
}

function formatDate(value) {
  const today = todayISO()
  if (value === today) return '今天'
  if (value === addDays(-1)) return '昨天'
  return value.slice(5).replace('-', '/')
}

function formatPeriodLabel(key, period) {
  if (period === 'day') {
    if (key === todayISO()) return '今天'
    if (key === addDays(-1)) return '昨天'
    return key.slice(5).replace('-', '/')
  }
  if (period === 'month') {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
  }
  return `${key}年`
}

function expenseRowsByPeriod(transactions, period) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 29)
  const cutoffKey = cutoff.toISOString().slice(0, 10)
  const group = new Map()
  transactions
    .filter((item) => item.type === 'expense')
    .filter((item) => period !== 'day' || item.date >= cutoffKey)
    .forEach((item) => {
      const key =
        period === 'day' ? item.date : period === 'month' ? item.date.slice(0, 7) : item.date.slice(0, 4)
      const current = group.get(key) || { key, amount: 0, count: 0 }
      current.amount += Number(item.amount)
      current.count += 1
      group.set(key, current)
    })

  const rows = Array.from(group.values()).sort((a, b) => b.key.localeCompare(a.key))
  const limitedRows = rows
  const maxAmount = Math.max(...limitedRows.map((item) => item.amount), 0)
  if (!limitedRows.length) {
    return [{ key: `empty-${period}`, label: '暂无支出', amount: 0, count: 0, percent: 0 }]
  }

  return limitedRows.map((item) => ({
    ...item,
    label: formatPeriodLabel(item.key, period),
    percent: maxAmount ? Math.max(Math.round((item.amount / maxAmount) * 100), 4) : 0,
  }))
}

function buildStats(transactions, budget) {
  const month = currentMonthISO()
  const today = todayISO()
  const year = today.slice(0, 4)
  const monthItems = transactions.filter((item) => item.date.startsWith(month))
  const todayItems = transactions.filter((item) => item.date === today)
  const yearItems = transactions.filter((item) => item.date.startsWith(year))
  const income = monthItems
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const expense = monthItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const todayExpense = todayItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const yearExpense = yearItems
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0)
  const categoryMap = monthItems
    .filter((item) => item.type === 'expense')
    .reduce((map, item) => {
      map[item.category] = (map[item.category] || 0) + Number(item.amount)
      return map
    }, {})
  const categoryStats = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: expense ? Math.round((amount / expense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
  const budgetPercent = budget ? Math.round((expense / budget) * 100) : 0
  const budgetTone = budgetPercent >= 100 ? 'over-budget' : budgetPercent >= 80 ? 'near-budget' : ''

  return {
    monthLabel: `${Number(month.slice(5))}月账本`,
    income,
    expense,
    balance: income - expense,
    budget,
    remainingBudget: Math.max(budget - expense, 0),
    budgetPercent,
    budgetTone,
    budgetMessage:
      budgetPercent >= 100
        ? `已超预算 ${yuan(expense - budget)}`
        : budgetPercent >= 80
          ? `接近预算，还可用 ${yuan(Math.max(budget - expense, 0))}`
          : `还可用 ${yuan(Math.max(budget - expense, 0))}`,
    todayExpense,
    yearExpense,
    dailyExpenseRows: expenseRowsByPeriod(transactions, 'day'),
    monthlyExpenseRows: expenseRowsByPeriod(transactions, 'month'),
    yearlyExpenseRows: expenseRowsByPeriod(transactions, 'year'),
    categoryStats: categoryStats.length ? categoryStats : [{ category: '暂无支出', amount: 0, percent: 0 }],
  }
}

export default App
