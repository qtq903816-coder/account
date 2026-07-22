import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  Home,
  Landmark,
  Pencil,
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
const quickAmounts = [5, 10, 20, 50, 100, 200]
const defaultCategories = {
  expense: ['餐饮', '交通', '购物', '居家', '娱乐', '医疗', '其他'],
  income: ['工资', '副业', '红包', '理财', '退款', '其他'],
}

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
  return toLocalISODate(new Date())
}

function addDays(days, baseDate = new Date()) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + days)
  return toLocalISODate(date)
}

function toLocalISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromISO(value) {
  return new Date(`${value}T00:00:00`)
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
      return { transactions: seedTransactions, budget: 3000, categories: defaultCategories }
    }
    const parsed = JSON.parse(raw)
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budget: Number(parsed.budget) || 3000,
      categories: normalizeCategories(parsed.categories),
    }
  } catch {
    return { transactions: seedTransactions, budget: 3000, categories: defaultCategories }
  }
}

function normalizeCategories(categories) {
  return {
    expense: mergeUnique(defaultCategories.expense, categories?.expense),
    income: mergeUnique(defaultCategories.income, categories?.income),
  }
}

function mergeUnique(...groups) {
  return Array.from(
    new Set(
      groups
        .flat()
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

function App() {
  const initialState = useMemo(() => loadState(), [])
  const [activeTab, setActiveTab] = useState('home')
  const [transactions, setTransactions] = useState(initialState.transactions)
  const [budget, setBudget] = useState(initialState.budget)
  const [categories, setCategories] = useState(initialState.categories)
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    category: initialState.categories.expense[0],
    note: '',
    date: todayISO(),
  })
  const [search, setSearch] = useState('')
  const [formError, setFormError] = useState('')
  const [quickForm, setQuickForm] = useState({
    amount: '',
    category: initialState.categories.expense[0],
    note: '',
    date: todayISO(),
  })
  const [quickError, setQuickError] = useState('')
  const [editForm, setEditForm] = useState(null)
  const [editError, setEditError] = useState('')
  const [toast, setToast] = useState(null)
  const [todayKey, setTodayKey] = useState(todayISO())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, budget, categories }))
  }, [transactions, budget, categories])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodayKey((current) => {
        const next = todayISO()
        return next === current ? current : next
      })
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const yesterday = addDays(-1, dateFromISO(todayKey))
    setForm((current) => (current.date === yesterday ? { ...current, date: todayKey } : current))
    setQuickForm((current) => (current.date === yesterday ? { ...current, date: todayKey } : current))
  }, [todayKey])

  const sortedCategories = useMemo(
    () => ({
      expense: sortCategoriesByUse(categories.expense, 'expense', transactions),
      income: sortCategoriesByUse(categories.income, 'income', transactions),
    }),
    [categories, transactions],
  )
  const stats = useMemo(() => buildStats(transactions, budget, todayKey), [transactions, budget, todayKey])
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

  useEffect(() => {
    setForm((current) => {
      const nextOptions = sortedCategories[current.type]
      return nextOptions.includes(current.category) ? current : { ...current, category: nextOptions[0] }
    })
    setQuickForm((current) =>
      sortedCategories.expense.includes(current.category) ? current : { ...current, category: sortedCategories.expense[0] },
    )
  }, [sortedCategories])

  function saveTransaction(event, sourceForm, setError, onSaved) {
    event.preventDefault()
    const amount = Number(sourceForm.amount)
    if (!amount || amount <= 0) {
      setError('请输入大于 0 的金额')
      return
    }

    const nextItem = {
      id: crypto.randomUUID(),
      type: sourceForm.type || 'expense',
      amount,
      category: sourceForm.category,
      note: sourceForm.note.trim(),
      date: sourceForm.date,
      createdAt: Date.now(),
    }
    setTransactions((items) => [nextItem, ...items])
    onSaved()
    setError('')
    setSearch('')
    showToast('已保存这一笔')
  }

  function submitTransaction(event) {
    saveTransaction(event, form, setFormError, () => {
      setForm((current) => ({
        ...current,
        amount: '',
        note: '',
        date: todayISO(),
      }))
    })
  }

  function submitQuickExpense(event) {
    saveTransaction(event, { ...quickForm, type: 'expense' }, setQuickError, () => {
      setQuickForm((current) => ({
        ...current,
        amount: '',
        note: '',
        date: todayISO(),
      }))
    })
  }

  function changeType(type) {
    setForm((current) => ({
      ...current,
      type,
      category: sortedCategories[type][0],
    }))
  }

  function addCategory(name) {
    const nextName = name.trim()
    if (!nextName) {
      setFormError('请输入标签名称')
      return
    }
    if (categories[form.type].includes(nextName)) {
      setForm({ ...form, category: nextName })
      setFormError('')
      showToast('已选中已有标签')
      return
    }
    setCategories((current) => ({
      ...current,
      [form.type]: [...current[form.type], nextName],
    }))
    setForm({ ...form, category: nextName })
    setFormError('')
    showToast(`已新增标签：${nextName}`)
  }

  function deleteTransaction(id) {
    const deleted = transactions.find((item) => item.id === id)
    if (!deleted) return

    setTransactions((items) => items.filter((item) => item.id !== id))
    if (editForm?.id === id) {
      setEditForm(null)
      setEditError('')
    }
    showToast('已删除一笔账单', {
      label: '撤销',
      onClick: () => {
        setTransactions((items) => [deleted, ...items].sort((a, b) => b.createdAt - a.createdAt))
        setToast(null)
      },
    })
  }

  function startEditTransaction(item) {
    setEditForm({
      id: item.id,
      type: item.type,
      amount: String(item.amount),
      category: item.category,
      note: item.note || '',
      date: item.date,
    })
    setEditError('')
  }

  function saveEditedTransaction(event) {
    event.preventDefault()
    const amount = Number(editForm.amount)
    if (!amount || amount <= 0) {
      setEditError('请输入大于 0 的金额')
      return
    }
    setTransactions((items) =>
      items.map((item) =>
        item.id === editForm.id
          ? {
              ...item,
              type: editForm.type,
              amount,
              category: editForm.category,
              note: editForm.note.trim(),
              date: editForm.date,
            }
          : item,
      ),
    )
    setEditForm(null)
    setEditError('')
    showToast('已更新账单')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ transactions, budget, categories }, null, 2)], {
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
          setCategories(normalizeCategories(parsed.categories))
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
            transactions={filteredTransactions}
            search={search}
            setSearch={setSearch}
            quickForm={quickForm}
            setQuickForm={setQuickForm}
            quickError={quickError}
            setQuickError={setQuickError}
            quickCategories={sortedCategories.expense}
            submitQuickExpense={submitQuickExpense}
            onAdd={() => setActiveTab('add')}
            onDelete={deleteTransaction}
            onEdit={startEditTransaction}
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
            categories={sortedCategories}
            addCategory={addCategory}
            submitTransaction={submitTransaction}
            recentTransactions={filteredTransactions.slice(0, 5)}
            onDelete={deleteTransaction}
            onEdit={startEditTransaction}
          />
        )}
        {activeTab === 'stats' && <StatsView stats={stats} transactions={transactions} todayKey={todayKey} />}
        {activeTab === 'settings' && (
          <SettingsView
            budget={budget}
            setBudget={setBudget}
            exportData={exportData}
            importData={importData}
            clearLedger={clearLedger}
            resetDemo={() => {
              setTransactions(seedTransactions)
              setCategories(defaultCategories)
              setSearch('')
              showToast('已恢复演示数据')
            }}
            transactionCount={transactions.length}
          />
        )}
      </section>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <EditTransactionDialog
        editForm={editForm}
        setEditForm={setEditForm}
        categories={sortedCategories}
        error={editError}
        setError={setEditError}
        onSave={saveEditedTransaction}
        onClose={() => {
          setEditForm(null)
          setEditError('')
        }}
      />
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

function HomeView({
  stats,
  transactions,
  search,
  setSearch,
  quickForm,
  setQuickForm,
  quickError,
  setQuickError,
  quickCategories,
  submitQuickExpense,
  onAdd,
  onDelete,
  onEdit,
  totalCount,
}) {
  return (
    <>
      <QuickExpensePanel
        form={quickForm}
        setForm={setQuickForm}
        formError={quickError}
        setFormError={setQuickError}
        categories={quickCategories}
        onSubmit={submitQuickExpense}
      />

      <section className={`balance-panel ${stats.budgetTone}`}>
        <div className="balance-row">
          <div>
            <p className="panel-label">今日支出</p>
            <strong>{yuan(stats.todayExpense)}</strong>
          </div>
          <button className="add-button" type="button" onClick={onAdd} aria-label="记一笔">
            <Plus size={22} />
          </button>
        </div>
        <div className="metric-grid">
          <Metric label="本月支出" value={yuan(stats.expense)} tone="expense" icon={<ArrowUpRight />} />
          <Metric label="今日可用" value={yuan(stats.dailyAllowance)} tone="income" icon={<ArrowDownLeft />} />
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
        onEdit={onEdit}
        isFiltered={Boolean(search.trim())}
        onClearSearch={() => setSearch('')}
      />
    </>
  )
}

function QuickExpensePanel({ form, setForm, formError, setFormError, categories, onSubmit }) {
  function setAmount(value) {
    setForm({ ...form, amount: String(value) })
    setFormError('')
  }

  return (
    <form className="quick-entry" onSubmit={onSubmit}>
      <label className="amount-field compact">
        <span>快速记消费</span>
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
      <div className="quick-category-row" aria-label="常用分类">
        {categories.slice(0, 5).map((category) => (
          <button
            type="button"
            key={category}
            className={form.category === category ? 'selected' : ''}
            onClick={() => setForm({ ...form, category })}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="quick-extra">
        <input
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
          placeholder="备注，可不填"
        />
        <button className="primary-action" type="submit">
          保存
        </button>
      </div>
    </form>
  )
}

function AddView({
  form,
  setForm,
  formError,
  setFormError,
  changeType,
  categories,
  addCategory,
  submitTransaction,
  recentTransactions,
  onDelete,
  onEdit,
}) {
  const [newCategory, setNewCategory] = useState('')
  const categoryOptions = categories[form.type]

  function setAmount(value) {
    setForm({ ...form, amount: String(value) })
    setFormError('')
  }

  function submitCategory() {
    addCategory(newCategory)
    setNewCategory('')
  }

  return (
    <>
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

        <div className="save-strip">
          <div className="save-date-shortcuts">
            <button type="button" onClick={() => setForm({ ...form, date: todayISO() })}>
              今天
            </button>
            <button type="button" onClick={() => setForm({ ...form, date: addDays(-1) })}>
              昨天
            </button>
          </div>
          <button className="primary-action" type="submit">
            保存
          </button>
        </div>

        <div className="category-grid">
          {categoryOptions.map((category) => (
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

        <details className="entry-more">
          <summary>备注、日期、标签</summary>
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

          <div className="tag-add">
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitCategory()
                }
              }}
              placeholder={form.type === 'expense' ? '新增支出标签' : '新增收入标签'}
            />
            <button type="button" onClick={submitCategory}>新增</button>
          </div>
        </details>
      </form>

      <SectionTitle title="刚保存的账单" action="最近 5 条" />
      <TransactionList transactions={recentTransactions} onDelete={onDelete} onEdit={onEdit} />
    </>
  )
}

function StatsView({ stats, transactions, todayKey }) {
  const [period, setPeriod] = useState('day')
  const [selectedDate, setSelectedDate] = useState(todayKey)
  useEffect(() => {
    setSelectedDate(todayKey)
  }, [todayKey])
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
  const selectedDay = currentView.rows.find((day) => day.key === selectedDate) || currentView.rows.at(-1)
  const selectedDayItems = transactions
    .filter((item) => item.type === 'expense' && item.date === selectedDay?.key)
    .sort((a, b) => b.createdAt - a.createdAt)

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

      <SectionTitle title={period === 'day' ? '最近 30 天日账单' : currentView.title} action={currentView.action} />
      {period === 'day' ? (
        <>
          <CalendarGrid
            days={currentView.rows}
            selectedDate={selectedDay?.key}
            todayKey={todayKey}
            onSelectDate={setSelectedDate}
          />
          <DayBillDetail day={selectedDay} transactions={selectedDayItems} />
        </>
      ) : (
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
      )}

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

function CalendarGrid({ days, selectedDate, todayKey, onSelectDate }) {
  return (
    <div className="calendar-grid" aria-label="最近 30 天日账单">
      {days.map((day) => (
        <button
          type="button"
          className={`calendar-day ${day.amount ? 'has-spend' : ''} ${day.key === todayKey ? 'today' : ''} ${day.key === selectedDate ? 'selected' : ''}`}
          key={day.key}
          onClick={() => onSelectDate(day.key)}
          style={{ '--intensity': day.intensity }}
          aria-label={`${day.label}支出${yuan(day.amount)}`}
        >
          <span>
            {day.label}
            <em>{day.weekday}</em>
          </span>
          <strong>{day.amount ? yuan(day.amount) : '-'}</strong>
        </button>
      ))}
    </div>
  )
}

function DayBillDetail({ day, transactions }) {
  if (!day) return null

  return (
    <section className="day-detail" aria-label={`${day.label}消费记录`}>
      <div className="day-detail-head">
        <div>
          <span>{day.label}</span>
          <strong>{day.amount ? yuan(day.amount) : '暂无支出'}</strong>
        </div>
        <b>{day.count} 笔</b>
      </div>
      {transactions.length ? (
        <TransactionList transactions={transactions} />
      ) : (
        <div className="day-empty">这一天还没有消费记录</div>
      )}
    </section>
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

function TransactionList({ transactions, onDelete, onEdit, isFiltered, onClearSearch }) {
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
          {onDelete || onEdit ? (
            <div className="transaction-actions">
              {onEdit ? (
                <button type="button" onClick={() => onEdit(item)} aria-label="编辑账单">
                  <Pencil size={15} />
                </button>
              ) : null}
              {onDelete ? (
                <button type="button" onClick={() => onDelete(item.id)} aria-label="删除账单">
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function EditTransactionDialog({ editForm, setEditForm, categories, error, setError, onSave, onClose }) {
  if (!editForm) return null
  const categoryOptions = categories[editForm.type]

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="edit-dialog" onSubmit={onSave} role="dialog" aria-modal="true" aria-label="编辑账单">
        <div className="edit-head">
          <strong>编辑账单</strong>
          <button type="button" onClick={onClose} aria-label="关闭编辑">
            <X size={18} />
          </button>
        </div>
        <div className="type-toggle" role="tablist" aria-label="收支类型">
          <button
            type="button"
            className={editForm.type === 'expense' ? 'selected' : ''}
            onClick={() => {
              const nextType = 'expense'
              setEditForm({ ...editForm, type: nextType, category: categories[nextType][0] })
            }}
          >
            支出
          </button>
          <button
            type="button"
            className={editForm.type === 'income' ? 'selected income' : ''}
            onClick={() => {
              const nextType = 'income'
              setEditForm({ ...editForm, type: nextType, category: categories[nextType][0] })
            }}
          >
            收入
          </button>
        </div>
        <label className="amount-field compact">
          <span>金额</span>
          <input
            inputMode="decimal"
            value={editForm.amount}
            onChange={(event) => {
              setEditForm({ ...editForm, amount: event.target.value })
              setError('')
            }}
            placeholder="0.00"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="category-grid compact-grid">
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              className={editForm.category === category ? 'selected' : ''}
              onClick={() => setEditForm({ ...editForm, category })}
            >
              {category}
            </button>
          ))}
        </div>
        <label className="field">
          <span>备注</span>
          <input
            value={editForm.note}
            onChange={(event) => setEditForm({ ...editForm, note: event.target.value })}
            placeholder="备注，可不填"
          />
        </label>
        <label className="field">
          <span>日期</span>
          <input
            type="date"
            value={editForm.date}
            onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
          />
        </label>
        <div className="edit-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-action" type="submit">
            保存修改
          </button>
        </div>
      </form>
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

function formatDate(value, today = todayISO()) {
  if (value === today) return '今天'
  if (value === addDays(-1, dateFromISO(today))) return '昨天'
  return value.slice(5).replace('-', '/')
}

function sortCategoriesByUse(categoryList, type, transactions) {
  const baseIndex = new Map(categoryList.map((category, index) => [category, index]))
  const usage = new Map()
  transactions
    .filter((item) => item.type === type)
    .forEach((item) => {
      const current = usage.get(item.category) || { count: 0, lastUsed: 0 }
      current.count += 1
      current.lastUsed = Math.max(current.lastUsed, Number(item.createdAt) || 0)
      usage.set(item.category, current)
    })

  return [...categoryList].sort((a, b) => {
    const usageA = usage.get(a) || { count: 0, lastUsed: 0 }
    const usageB = usage.get(b) || { count: 0, lastUsed: 0 }
    return (
      usageB.count - usageA.count ||
      usageB.lastUsed - usageA.lastUsed ||
      (baseIndex.get(a) ?? 0) - (baseIndex.get(b) ?? 0)
    )
  })
}

function daysRemainingInMonth(today) {
  const date = dateFromISO(today)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return lastDay - date.getDate() + 1
}

function formatPeriodLabel(key, period, today = todayISO()) {
  if (period === 'day') {
    if (key === today) return '今天'
    if (key === addDays(-1, dateFromISO(today))) return '昨天'
    return key.slice(5).replace('-', '/')
  }
  if (period === 'month') {
    const [year, month] = key.split('-')
    return `${year}年${Number(month)}月`
  }
  return `${key}年`
}

function expenseRowsByPeriod(transactions, period, today = todayISO()) {
  const cutoff = dateFromISO(today)
  cutoff.setDate(cutoff.getDate() - 29)
  const cutoffKey = toLocalISODate(cutoff)
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

  if (period === 'day') {
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = dateFromISO(today)
      date.setDate(date.getDate() - (29 - index))
      const key = toLocalISODate(date)
      const value = group.get(key) || { key, amount: 0, count: 0 }
      return {
        ...value,
        weekday: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date),
      }
    })
    const maxAmount = Math.max(...days.map((item) => item.amount), 0)
    return days.map((item) => ({
      ...item,
      label: formatPeriodLabel(item.key, period, today),
      percent: maxAmount && item.amount ? Math.max(Math.round((item.amount / maxAmount) * 100), 4) : 0,
      intensity: maxAmount && item.amount ? 0.12 + (item.amount / maxAmount) * 0.78 : 0,
    }))
  }

  const rows = Array.from(group.values()).sort((a, b) => b.key.localeCompare(a.key))
  const limitedRows = rows
  const maxAmount = Math.max(...limitedRows.map((item) => item.amount), 0)
  if (!limitedRows.length) {
    return [{ key: `empty-${period}`, label: '暂无支出', amount: 0, count: 0, percent: 0 }]
  }

  return limitedRows.map((item) => ({
    ...item,
    label: formatPeriodLabel(item.key, period, today),
    percent: maxAmount ? Math.max(Math.round((item.amount / maxAmount) * 100), 4) : 0,
  }))
}

function buildStats(transactions, budget, today = todayISO()) {
  const month = today.slice(0, 7)
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
  const daysLeftInMonth = daysRemainingInMonth(today)
  const dailyAllowance = daysLeftInMonth ? Math.max((budget - expense) / daysLeftInMonth, 0) : 0
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
    dailyAllowance,
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
    dailyExpenseRows: expenseRowsByPeriod(transactions, 'day', today),
    monthlyExpenseRows: expenseRowsByPeriod(transactions, 'month', today),
    yearlyExpenseRows: expenseRowsByPeriod(transactions, 'year', today),
    categoryStats: categoryStats.length ? categoryStats : [{ category: '暂无支出', amount: 0, percent: 0 }],
  }
}

export default App
