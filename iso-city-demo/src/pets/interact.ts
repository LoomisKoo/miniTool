// 宠物交互点：只暴露「离玩家最近的那一只」。
//
// 为什么不给 40 只宠物各建一个交互点：玩家同时只会看到一只，40 个候选点
// 每次检测都要算距离，而且 nearby 面板只会显示一个。取最近即可。
//
// 交互半径 3.4m 略大于 flinch 的 2.6m——站在它不会逃跑的距离上才能观察它。
//
// 城里和家里共用 openPetDialog：同一只宠物在街上是「野生 / 有主人」，
// 在户内是「在你家」，但喂食、改名、看主页这些选项没有理由写两套。

import { walker } from '../game/walker'
import { useApp, type DialogChoice } from '../store'
import { askPrompt } from '../ui/Ask'
import type { Interactable } from '../scene/PlayerRig'
import { live, type LivePet } from './live'
import { HUNGRY_AT } from './hunger'
import { insideRoad } from '../data/city'

const REACH = 3.4

const LINES: Record<string, string[]> = {
  猫: ['它歪头看你一眼，又低头舔了舔爪子。', '尾巴尖轻轻摆了一下——不是害怕，是懒得理你。'],
  狗: ['它凑上来闻了闻你的鞋，然后坐得笔直。', '尾巴摇得很卖力，像是在等一句夸奖。'],
  兔子: ['耳朵转向你的方向，身体却一动不动。', '鼻子飞快地抽动着，好像在研究你身上的味道。'],
  小鸡: ['它啾啾叫了两声，绕着你的脚转了一圈。', '低头啄了啄地面，什么也没啄到。'],
  小猪: ['它哼哼着拱了拱你的鞋带。', '圆滚滚的身子往你腿边一靠，不走了。'],
  鹦鹉: ['它侧过头打量你，一只眼，又换另一只眼。', '「你好！」——它好像是在学路人说话。'],
  狐狸: ['它和你保持距离，眼神比一般的野猫更冷静。', '蓬松的尾巴在身后扫过地面。'],
  河狸: ['它捧着一根小树枝，警惕地看着你。', '扁扁的尾巴拍了一下地面，啪。'],
  野猪: ['它用鼻子翻着地上的落叶，没空理你。', '哼了一声，獠牙在阳光下闪了一下。'],
  考拉: ['它眯着眼，看起来随时会睡着。', '慢吞吞地眨了一下眼，又眨了一下。'],
  企鹅: ['它摇摇摆摆地往前挪了两步，又停下来看你。', '拍了拍小翅膀，好像在打招呼。'],
  猴子: ['它挠了挠头，学着你的样子歪了歪脑袋。', '眼珠一转，像在盘算你兜里有没有零食。'],
  小鹿: ['它竖起耳朵，随时准备跳开。', '湿漉漉的大眼睛盯着你看了好一会儿。'],
  熊猫: ['它抱着自己的脚坐了下来，一脸无辜。', '慢悠悠地打了个滚，又坐回原地。'],
  熊: ['它站得稳稳的，比你想象的要温和。', '鼻子在空气里嗅了嗅，转身慢慢走开。'],
  老虎: ['它安静地看着你，条纹在影子里若隐若现。', '打了个大大的哈欠——幸好只是哈欠。'],
}

export function petInteractables(): Interactable[] {
  let best = -1
  let bestDistance = REACH
  for (let i = 0; i < live.length; i++) {
    const pet = live[i]
    if (!pet.breed || insideRoad(pet.x, pet.z, 0.8)) continue
    const d = Math.hypot(pet.x - walker.position.x, pet.z - walker.position.z)
    if (d < bestDistance) {
      bestDistance = d
      best = i
    }
  }
  if (best < 0) return []

  const pet = live[best]
  // 图鉴按 raw breed id 记账：同一张卡下的色型各记各的，卡的「已发现」= 任一色型见过
  const key = `${pet.speciesId}/${pet.breedId}`
  const name = pet.nickname || pet.breed
  const owner = pet.owner
  // 饿的宠物只用一句话传达：它是被遗忘了，不是出了故障。
  // 访客看到的那句带点怂恿，主人看到的带点催促。
  const hungry = Boolean(owner) && pet.hunger < HUNGRY_AT

  return [
    {
      id: `pet-${pet.id}`,
      label: name,
      hint: owner
        ? hungry
          ? `按 E 互动 · 它好像饿了`
          : `按 E 互动 · 主人 @${owner.name}`
        : useApp.getState().pets.length > 0
          ? '按 E 互动'
          : '按 E 互动 · 可以领养',
      x: pet.x,
      z: pet.z,
      radius: REACH,
      action: () => {
        // 记录在按下 E 的那一刻，而不是走进范围时：图鉴记的是"你观察过它"。
        useApp.getState().recordPet(key)
        openPetDialog(pet)
      },
    },
  ]
}

/** 一只宠物的一段对话。位置取传入的 pet，城里用实时坐标，家里用房间坐标。 */
export function openPetDialog(pet: LivePet) {
  const app = useApp.getState()
  const lines = LINES[pet.species] ?? ['它看了你一会儿，然后转身走开了。']
  const name = pet.nickname || pet.breed
  const owner = pet.owner
  const hungry = Boolean(owner) && pet.hunger < HUNGRY_AT

  // 有主人的宠物：对话里固定显示主人条，这是「查看主人信息」的入口。
  if (owner) {
    const own = owner.id === app.user?.id
    const petPanel = { id: pet.id, own }
    const petOwner = { name: owner.name, color: owner.color, since: pet.adoptedAt ?? null }
    const openHome = () => {
      useApp.getState().closeDialog()
      useApp.getState().openPanel({ type: 'pet', id: pet.id })
    }
    const feed = async () => {
      const ok = await useApp.getState().feedPet(pet.id)
      if (ok) openHome()
    }
    // 看主页对谁都开放：喂食只是「能不能写」的门槛，不是「能不能看」的门槛。
    // 自己的宠物平时不显示喂食（留言不需要喂，白扣一份口粮没有意义）；
    // 只有它饿的时候才把「喂它」摆出来——那时喂食才真的有作用。
    const choices: DialogChoice[] = own
      ? [
          ...(hungry
            ? [{ label: '喂它', note: '消耗 1 份口粮', primary: true, onClick: feed }]
            : []),
          { label: '看它的主页', primary: !hungry, onClick: openHome },
          {
            label: '给它改名',
            onClick: () => {
              void askPrompt('给它取个新名字', name, {
                title: '给宠物改名',
                confirmLabel: '改名',
                placeholder: '最多 24 个字',
              }).then((next) => {
                const trimmed = next?.trim()
                if (trimmed) void useApp.getState().renamePet(pet.id, trimmed)
              })
            },
          },
          { label: '先不打扰它', onClick: () => useApp.getState().closeDialog() },
        ]
      : [
          {
            label: '喂它一顿',
            note: '消耗 1 份口粮',
            primary: true,
            onClick: feed,
          },
          { label: '看它的主页', onClick: openHome },
          { label: '先不打扰它', onClick: () => useApp.getState().closeDialog() },
        ]
    app.openDialog({
      name,
      role: `主人 @${owner.name}`,
      lines: own
        ? [
            ...lines,
            hungry
              ? '它趴在常去的那个角落，没什么精神——你有一阵子没来看它了。'
              : '它是你的伙伴，在图鉴顶部随时能找到它。',
          ]
        : [
            ...lines,
            `它的主人是 @${owner.name}，平时由对方照顾。`,
            ...(hungry ? ['它好像已经等了很久，毛都暗下去了。'] : []),
          ],
      x: pet.x,
      z: pet.z,
      owner: petOwner,
      pet: petPanel,
      choices,
    })
    return
  }

  // 野生宠物：最后一句给出「领养 / 再陪一会儿」两个选择。
  // 每人只能领养一只，已有宠物时直接把领养选项收起来，
  // 不要等玩家点了再弹一个后端错误。
  const hasPet = app.pets.length > 0
  app.openDialog({
    name,
    role: `野生${pet.species}`,
    lines: hasPet ? [...lines, '你已经有一位伙伴了，它正在城里等你。'] : lines,
    x: pet.x,
    z: pet.z,
    choices: [
      hasPet
        ? {
            label: '再陪它一会儿',
            primary: true,
            onClick: () => useApp.getState().closeDialog(),
          }
        : {
            label: '带它回家（领养）',
            primary: true,
            onClick: async () => {
              const adopted = await useApp.getState().adoptPet({
                id: pet.id,
                speciesId: pet.speciesId,
                breedId: pet.breedId,
                scale: pet.scale,
                spot: pet.spot,
              })
              if (!adopted) return
              const user = useApp.getState().user
              useApp.getState().openDialog({
                name,
                role: user ? `主人 @${user.name}` : '你的宠物',
                lines: ['它凑近闻了闻你的手，尾巴轻轻摇了起来。', '从现在起，它会留在城里等你回来。'],
                x: pet.x,
                z: pet.z,
                owner: {
                  name: user?.name ?? '你',
                  color: user?.color ?? '#f2c86b',
                  since: adopted.adoptedAt,
                },
                pet: { id: adopted.id, own: true },
              })
            },
          },
      ...(hasPet ? [] : [{ label: '再陪它一会儿', onClick: () => useApp.getState().closeDialog() }]),
    ],
  })
}
