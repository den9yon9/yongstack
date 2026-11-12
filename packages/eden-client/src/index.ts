// eden treaty 类型提取工具
// 全部类型源自 eden 契约（= 后端 TypeBox schema 推导），零运行时成本

// eden 方法签名: (params?, options?) => Promise<{ data, error, status, ... }>
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 类型工具必须放宽签名以接受 treaty 具体方法
export type EdenMethod = (...args: any[]) => Promise<any>

// 响应数据类型提取
export type EdenData<T extends EdenMethod> = NonNullable<Awaited<ReturnType<T>>['data']>
// 列表响应（项目约定 PaginatedResponse{ items, total, page, pageSize }）元素类型
export type EdenListItem<T extends EdenMethod> = EdenData<T>['items'][number]
