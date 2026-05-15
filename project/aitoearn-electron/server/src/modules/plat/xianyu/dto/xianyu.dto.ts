import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateXianyuItemDto {
  @ApiProperty({ description: '商品标题（30字以内）' })
  @IsString()
  title: string;

  @ApiProperty({ description: '商品描述', required: false })
  @IsString()
  @IsOptional()
  desc?: string;

  @ApiProperty({ description: '一口价，单位：元', required: false })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiProperty({ description: '起拍价 / 保留价', required: false })
  @IsNumber()
  @IsOptional()
  reservePrice?: number;

  @ApiProperty({ description: '商品图片 URL 列表（1-9 张）', type: [String] })
  @IsArray()
  @IsString({ each: true })
  imgUrlList: string[];

  @ApiProperty({ description: '视频 URL', required: false })
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @ApiProperty({ description: '成色：1=全新, 2=99新, 3=95新, 4=9成新, 5=8成新及以下', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  stuffStatus?: 1 | 2 | 3 | 4 | 5;

  @ApiProperty({ description: '是否包邮', required: false })
  @IsBoolean()
  @IsOptional()
  freeShipping?: boolean;

  @ApiProperty({ description: '类目 ID', required: false })
  @IsInt()
  @IsOptional()
  catId?: number;

  @ApiProperty({ description: '鱼塘 / 兴趣圈 ID', required: false })
  @IsInt()
  @IsOptional()
  fishpondId?: number;
}

export class XianyuItemFilterDto {
  @ApiProperty({ description: '账号 ID' })
  @IsString()
  accountId: string;

  @ApiProperty({ description: '商品状态过滤', required: false })
  @IsString()
  @IsOptional()
  status?: 'on_sale' | 'sold_out' | 'offline' | 'reviewing' | 'rejected';

  @ApiProperty({ description: '每页数量', required: false })
  @IsInt()
  @IsOptional()
  pageSize?: number = 20;

  @ApiProperty({ description: '页码', required: false })
  @IsInt()
  @IsOptional()
  page?: number = 1;
}
