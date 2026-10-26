// 野生宠物的实时位置。
//
// 宠物每帧在动，而交互点（PlayerRig 里那张 interactables 表）是静态的。
// 与其每帧重建整张表，不如让宠物把位置写进这个共享数组，交互检测每 0.14s
// 扫一遍就够了。写入是就地覆盖，不产生垃圾。

export type LivePet = {
  id: string
  speciesId: string
  species: string
  breedId: string
  breed: string
  x: number
  z: number
  y: number
  /** 交互半径：跟着体长走，狗比刺猬远一点才合理 */
  radius: number
}

export const live: LivePet[] = []
