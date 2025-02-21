package utils

import (
	"context"
	"sync"
)

type Task func(ctx context.Context)

type TaskPool struct {
	maxTasks int
	tasks    chan taskWithToken
	wg       sync.WaitGroup
	ctx      context.Context
	cancel   context.CancelFunc
	tokens   map[string]struct{}
	mu       sync.Mutex
}

type taskWithToken struct {
	task  Task
	token string
}

func NewTaskPool(ctx context.Context, maxTasks int) *TaskPool {
	ctx, cancel := context.WithCancel(ctx)
	return &TaskPool{
		maxTasks: maxTasks,
		tasks:    make(chan taskWithToken, maxTasks),
		ctx:      ctx,
		cancel:   cancel,
		tokens:   make(map[string]struct{}),
	}
}

func (tp *TaskPool) Start() {
	for i := 0; i < tp.maxTasks; i++ {
		tp.wg.Add(1)
		go tp.worker()
	}
}

func (tp *TaskPool) worker() {
	defer tp.wg.Done()
	for {
		select {
		case taskWithToken, ok := <-tp.tasks:
			if !ok {
				return
			}
			taskWithToken.task(tp.ctx)
			tp.mu.Lock()
			delete(tp.tokens, taskWithToken.token)
			tp.mu.Unlock()
		case <-tp.ctx.Done():
			return
		}
	}
}

func (tp *TaskPool) AddTask(task Task, token string) bool {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	if _, exists := tp.tokens[token]; exists {
		return false
	}

	select {
	case tp.tasks <- taskWithToken{task: task, token: token}:
		tp.tokens[token] = struct{}{}
		return true
	default:
		return false
	}
}

func (tp *TaskPool) LeftSlots() int {
	return tp.maxTasks - len(tp.tasks)
}

func (tp *TaskPool) OccupiedTokens() map[string]struct{} {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	tokens := make(map[string]struct{}, len(tp.tokens))
	for token := range tp.tokens {
		tokens[token] = struct{}{}
	}
	return tokens
}

func (tp *TaskPool) IsOccupied(token string) bool {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	_, exists := tp.tokens[token]
	return exists
}

func (tp *TaskPool) Stop() {
	close(tp.tasks)
	tp.cancel()
	tp.wg.Wait()
}
